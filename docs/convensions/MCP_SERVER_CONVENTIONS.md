# MCP Server Conventions

These conventions govern anyone adding a new tool to the `mcp-server/` package or maintaining the existing ones. Follow these rules to keep the server consistent, auditable, and safe.

---

## 1. Package Identity

- The MCP server is a **standalone Node.js package** — no NestJS, no class-validator, no class-transformer.
- It lives at `mcp-server/` from the repo root and is not part of the backend or frontend build.
- It communicates with the backend exclusively via the REST API over HTTP. It never imports Prisma or backend service code.
- Entry point: `dist/index.js` (compiled from `src/index.ts` via `npm run build`).

---

## 2. Tool Naming

- Tool names use **snake_case verbs**: `search_orders`, `propose_inventory_adjustment`, not `getOrders` or `SearchOrders`.
- Tool names should describe the action, not the entity: `check_inventory` not `inventory`.
- Keep the surface small. Every tool added increases the context window AI assistants consume. Add tools only when there is a clear, non-overlapping use case.

---

## 3. One File Per Tool

Each tool lives in its own file under `src/tools/`:

```
src/tools/
├── search-orders.ts
├── get-order-details.ts
├── get-orders-for-customer.ts
├── check-inventory.ts
├── search-products.ts
├── propose-inventory-adjustment.ts
└── list-low-stock-products.ts
```

Each file exports a single `register<ToolName>(server, config, tokenManager)` function. No tool implementation should live in `server.ts` or `index.ts`.
Shared registration glue belongs in `src/tools/register-tool.ts`.

---

## 4. Input Schema Rules (Zod)

All tool input schemas use Zod. No exceptions.

```typescript
// Good
const inputSchema = {
  orderId: z.string().uuid().describe('UUID of the order to fetch'),
  limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
};

// Bad — missing .describe(), using raw TypeScript type
const inputSchema = { orderId: z.string() };
```

**Rules:**
- Every field in a Zod schema **must** have `.describe()`. The description is what Claude reads to understand what to pass.
- Use `.optional()` for optional fields; never use `.nullable()` unless the backend explicitly accepts null.
- Use `.default()` for fields that have sensible defaults (e.g., `limit`).
- Enums in tool schemas must mirror the backend's Prisma enums exactly. If the backend adds an enum value, update the Zod enum here.
- Tool input schemas are passed as `inputSchema: InputSchema as z.ZodTypeAny` to `server.registerTool()`. The cast is required — see §5.

---

## 5. Tool Registration

Use the local `registerTool()` helper from `src/tools/register-tool.ts` (not the deprecated `server.tool()` and not `server.registerTool()` directly inside tool files).

**Always cast `inputSchema` to `z.ZodTypeAny`** — the MCP SDK's `registerTool` generic constraint `InputArgs extends undefined | ZodRawShapeCompat | AnySchema` triggers TS2589 ("type instantiation is excessively deep") when TypeScript tries to infer through Zod's recursive union types. The local helper keeps that generic boundary untyped, and the `z.ZodTypeAny` upcast keeps the config stable at the call site.

**Do not destructure handler args in the callback signature.** Accept `rawArgs` first, then cast and destructure inside the handler body. Directly destructuring `async ({ ... }) => {}` can re-trigger the same deep-instantiation failure even when `inputSchema` is cast.

```typescript
const InputSchema = z.object({
  orderId: z.string().uuid().describe('UUID of the order to fetch'),
});
type Input = z.infer<typeof InputSchema>;

export function registerMyTool(
  server: McpServer,
  config: Config,
  tokenManager: TokenManager,
): void {
  registerTool(
    server,
    'my_tool',
    {
      description: 'One-paragraph description visible to the AI assistant.',
      inputSchema: InputSchema as z.ZodTypeAny,  // required — avoids TS2589
    },
    async (rawArgs) => {
      const { orderId } = rawArgs as Input;  // restore type safety inside handler
      // ...
    },
  );
}
```

Register all tools in `server.ts` inside `createMcpServer()`. New tools must be added there.

---

## 6. Token Management

**Never hold an access token across calls.**

Every tool handler must call `buildToolContext(tokenManager, config.MCP_ORGANIZATION_ID)` at the top of the handler. The `TokenManager` handles all caching, refresh, and re-login transparently.

```typescript
// Correct
async (args) => {
  const ctx = await buildToolContext(tokenManager, config.MCP_ORGANIZATION_ID);
  // use ctx.accessToken, ctx.correlationId, ctx.organizationId
}

// Wrong — caching a token across calls
let cachedToken: string;
async (args) => {
  if (!cachedToken) cachedToken = await tokenManager.getAccessToken();
  // ...
}
```

**Token manager behaviour (three tiers):**
1. **Cache hit**: returns in-memory access token if not expiring within 60 seconds.
2. **Refresh**: calls `POST /auth/refresh` using the in-memory refresh token.
3. **Login**: falls back to `POST /auth/login` on first run or after refresh token expires.

No manual token rotation is needed. Configure `MCP_SERVICE_EMAIL` + `MCP_SERVICE_PASSWORD` in the host environment.

---

## 7. Auth Header Forwarding

Every backend call must include all three auth headers. Use `buildBackendHeaders(ctx)`:

```typescript
const { data } = await client.get('/orders', {
  headers: buildBackendHeaders(ctx),
  params: { ... },
});
```

`buildBackendHeaders` returns:
- `Authorization: Bearer <accessToken>`
- `X-Organization-Id: <organizationId>`
- `X-Request-Id: <correlationId>` (fresh UUID per tool call)

Never hardcode these headers. Never reuse a `ToolContext` from a previous call.

---

## 8. Correlation IDs

`buildToolContext` generates a fresh UUID (correlation ID) for each tool call. Pass this ID through:
- All backend requests via the `X-Request-Id` header
- All `logToolCall` invocations via `correlationId`
- The AI attribution note prefix for mutating tools (see §9)

---

## 9. Mutating Tools

Any tool that writes to the backend (POST, PATCH, DELETE) must:

1. Set `isMutating: true` in `logToolCall` — this emits `ai_mutating_action: true` in JSON logs, making AI-originated writes filterable in Loki/Grafana.

2. Prefix the note or description field with `[AI/MCP correlationId:<uuid>]` so the write is identifiable in the backend's own audit records without a schema change:

```typescript
const aiNote = [`[AI/MCP correlationId:${ctx.correlationId}]`, note]
  .filter(Boolean)
  .join(' ');
```

3. Document the tool's mutating nature clearly in its `description` so AI assistants know to use it deliberately.

---

## 10. Error Handling

**Always throw `mapAxiosErrorToMcp(err)`** — never return error strings in content or swallow errors silently.

```typescript
try {
  const { data } = await client.get('/orders', { headers: buildBackendHeaders(ctx) });
  // ...
} catch (err) {
  logToolCall({ ..., resultStatus: 'error' });
  throw mapAxiosErrorToMcp(err);  // translates HTTP status to McpError code
}
```

HTTP → MCP error code mapping:
| Backend HTTP | `ErrorCode` |
|---|---|
| 400 | `InvalidParams` |
| 401, 403, 404 | `InvalidRequest` |
| 5xx | `InternalError` |

---

## 11. Response Format

Return plain JSON text content. Do not summarize or reformat backend responses — return the full payload and let the AI assistant interpret it:

```typescript
return {
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
};
```

---

## 12. Logging

Call `logToolCall` at both success and error exit paths. Never skip either:

```typescript
logToolCall({
  tool: 'my_tool',
  organizationId: ctx.organizationId,
  correlationId: ctx.correlationId,
  durationMs: Date.now() - startMs,
  resultStatus: 'success',  // or 'error'
  isMutating: true,         // only for mutating tools
});
```

The logger writes structured JSON (pino). Log level is controlled via `LOG_LEVEL` env var.
For stdio MCP servers, logger output must go to `stderr`, never `stdout`, because `stdout` is reserved for MCP JSON-RPC messages only.

---

## 13. Testing

Every tool ships a `.spec.ts` in `test/tools/`. Tests must:

1. **Mock `getLedgerlightClient`** — return a jest mock with `get` and `post` spies. Never make real HTTP calls.
2. **Mock `buildToolContext`** — return a fixed context with known `organizationId`, `accessToken`, and `correlationId` to make assertions deterministic.
3. **Access the handler** via `server._registeredTools['tool_name'].handler` (the `_registeredTools` property is a plain object keyed by tool name).
4. **Assert** correct URL path, query params, and all three auth headers.
5. **Assert** error mapping for at minimum 400, 403, and 404 responses.
6. **Assert** the AI attribution note prefix for mutating tools.

See `test/tools/propose-inventory-adjustment.spec.ts` as the reference implementation.

---

## 14. Linting

- The package uses a local flat ESLint config at `mcp-server/eslint.config.mjs`.
- Run `npm run lint` from `mcp-server/` before considering MCP package work complete.
- Workspace VS Code settings in `.vscode/settings.json` register `mcp-server/` as an ESLint working directory, use ESLint as the default formatter for TS/JS files, and point the Prettier extension at `mcp-server/node_modules/prettier`.
- Keep tool files compatible with autofix so imports and formatting can be cleaned up on save without manual churn.

---

## 15. Adding a New Tool — Checklist

- [ ] Create `src/tools/<kebab-case-name>.ts`
- [ ] Export `register<PascalCaseName>(server, config, tokenManager)` function
- [ ] All Zod fields have `.describe()`
- [ ] Handler calls `buildToolContext` before any backend call
- [ ] Handler calls `buildBackendHeaders(ctx)` for every request
- [ ] Handler calls `logToolCall` at both success and error exits
- [ ] Mutating tool: `isMutating: true` + AI note prefix
- [ ] Import and call `register*` in `src/server.ts`
- [ ] Create `test/tools/<kebab-case-name>.spec.ts` with happy path + error cases
- [ ] All tests pass: `npm run test:run`
- [ ] Lint passes: `npm run lint`
- [ ] Update `docs/MCP_SERVER.md` tool catalog section
