# LedgerLight MCP Server — Implementation Plan

## Context

LedgerLight needs a Model Context Protocol (MCP) server so AI assistants (Claude Desktop, etc.) can query and act on live order, inventory, product, and customer data. The server must enforce the same multi-tenancy, auth, and audit constraints as the backend — but it is a **standalone Node.js process**, not a NestJS app.

**Architecture: HTTP client (Option B)**  
The backend's services depend on NestJS DI. The MCP server calls the existing REST API over HTTP, forwarding a JWT Bearer token + `X-Organization-Id` header. The backend's own guards enforce org scoping and permissions — the MCP server only needs to attach the correct headers and map errors cleanly.

---

## Deliverables

| Artifact           | Path                                         |
| ------------------ | -------------------------------------------- |
| MCP server package | `mcp-server/` (repo root)                    |
| Conventions doc    | `docs/convensions/MCP_SERVER_CONVENTIONS.md` |
| Architecture doc   | `docs/MCP_SERVER.md`                         |

---

## Directory Tree — `mcp-server/`

```
mcp-server/
├── package.json
├── tsconfig.json
├── jest.config.ts
├── .env.example
├── src/
│   ├── index.ts                         # Entry point: node dist/index.js
│   ├── server.ts                        # McpServer construction + tool registration
│   ├── config.ts                        # Zod env-var loading
│   ├── auth/
│   │   ├── token-manager.ts             # In-memory access token cache; auto-refresh via /auth/refresh
│   │   ├── token-context.ts             # ToolContext interface; calls TokenManager.getAccessToken()
│   │   └── header-builder.ts            # Builds Authorization / X-Organization-Id / X-Request-Id
│   ├── client/
│   │   ├── ledgerlight-client.ts        # Axios singleton factory
│   │   └── error-mapper.ts             # AxiosError → McpError translation
│   ├── logger/
│   │   └── logger.ts                    # Pino JSON logger + logToolCall helper
│   └── tools/
│       ├── search-orders.ts
│       ├── get-order-details.ts
│       ├── get-orders-for-customer.ts
│       ├── check-inventory.ts
│       ├── search-products.ts
│       ├── propose-inventory-adjustment.ts
│       └── list-low-stock-products.ts
└── test/
    ├── setup.ts                         # Injects env vars for all tests
    ├── mocks/
    │   └── axios.mock.ts
    └── tools/
        └── *.spec.ts                    # One spec per tool
```

---

## Token Lifecycle — Full Auth Flow

JWTs expire in ~15 minutes. The `TokenManager` handles the entire credential lifecycle automatically via a **three-tier strategy**. No manual token rotation is needed during normal operation.

### Three-Tier Strategy

```
Tier 1 — Access token cache
  └── in-memory access token still valid (exp > now + 60s)?
      YES → return immediately (no network call)
      NO  → fall through to Tier 2

Tier 2 — Refresh token (in-memory, acquired after first login)
  └── in-memory refresh token present?
      YES → POST /auth/refresh { refreshTokenRaw, userId }
            → on success: update in-memory accessToken + exp, return
            → on failure (token revoked/expired): fall through to Tier 3
      NO  → fall through to Tier 3

Tier 3 — Credential login (first run or after refresh token expired)
  └── POST /auth/login { email, password }
      → store accessToken + exp in memory
      → store refreshToken + userId in memory (Tier 2 used from now on)
      → return accessToken
```

**Startup**: On first tool call (or process restart), Tier 1 and 2 miss → Tier 3 fires a single login call. After that, only Tier 2 fires every ~15 min. If the refresh token expires after 7 days, Tier 3 fires automatically — no operator intervention needed.

**No manual rotation**: Config only ever needs `MCP_SERVICE_EMAIL` + `MCP_SERVICE_PASSWORD`. The `TokenManager` manages all tokens entirely in memory.

### `src/auth/token-manager.ts`

```typescript
import axios from "axios";
import { decodeJwt } from "jose";
import type { Config } from "../config.js";

interface TokenState {
  accessToken: string;
  accessTokenExpSec: number;
  refreshToken: string;
  userId: string;
}

export class TokenManager {
  private state: TokenState | null = null;
  private static readonly BUFFER_SEC = 60;

  constructor(private readonly config: Config) {}

  async getAccessToken(): Promise<string> {
    const nowSec = Math.floor(Date.now() / 1000);

    // Tier 1: cached access token still valid
    if (
      this.state &&
      this.state.accessTokenExpSec > nowSec + TokenManager.BUFFER_SEC
    ) {
      return this.state.accessToken;
    }

    // Tier 2: have refresh token — try silent re-issue
    if (this.state?.refreshToken) {
      try {
        const res = await axios.post<{ accessToken: string }>(
          `${this.config.BACKEND_URL}/auth/refresh`,
          {
            refreshTokenRaw: this.state.refreshToken,
            userId: this.state.userId,
          },
        );
        const accessToken = res.data.accessToken;
        const claims = decodeJwt(accessToken);
        this.state = {
          ...this.state,
          accessToken,
          accessTokenExpSec:
            typeof claims.exp === "number" ? claims.exp : nowSec + 900,
        };
        return this.state.accessToken;
      } catch {
        this.state = null; // refresh token expired/revoked → fall through to login
      }
    }

    // Tier 3: full credential login
    const res = await axios.post<{
      accessToken: string;
      refreshToken: { token: string };
      user: { id: string };
    }>(`${this.config.BACKEND_URL}/auth/login`, {
      email: this.config.MCP_SERVICE_EMAIL,
      password: this.config.MCP_SERVICE_PASSWORD,
    });

    const { accessToken, refreshTokenRaw, user } = res.data;
    const claims = decodeJwt(accessToken);
    this.state = {
      accessToken,
      accessTokenExpSec:
        typeof claims.exp === "number" ? claims.exp : nowSec + 900,
      refreshToken: refreshTokenRaw,
      userId: user.id,
    };
    return this.state.accessToken;
  }
}
```

**Singleton**: `createMcpServer(config)` constructs one `TokenManager` and passes it to every `register*()` call. Tool handlers call `await tokenManager.getAccessToken()` — tokens are never held between invocations.

### `src/auth/token-context.ts`

```typescript
export interface ToolContext {
  organizationId: string;
  accessToken: string; // always fresh from TokenManager
  correlationId: string;
}

export async function buildToolContext(
  tokenManager: TokenManager,
  organizationId: string,
): Promise<ToolContext> {
  const accessToken = await tokenManager.getAccessToken();
  return { organizationId, accessToken, correlationId: randomUUID() };
}
```

---

## Key Dependencies (`package.json`)

```json
{
  "name": "@ledgerlight/mcp-server",
  "type": "commonjs",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "start": "node dist/index.js",
    "dev": "ts-node --project tsconfig.json src/index.ts",
    "test": "jest",
    "test:run": "jest --runInBand",
    "test:cov": "jest --coverage",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\" --fix"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.8.4",
    "jose": "^5.9.6",
    "pino": "^9.6.0",
    "pino-pretty": "^13.0.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "@types/node": "^22.10.7",
    "jest": "^30.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.3"
  }
}
```

`tsconfig.json` uses `"module": "commonjs"` (not `nodenext`) — the MCP SDK and pino both ship CJS entry points and the server starts with plain `node`.

---

## Core Types & Interfaces

### `src/config.ts`

Zod-validated env config:

```typescript
const ConfigSchema = z.object({
  BACKEND_URL: z.string().url(),
  MCP_SERVICE_EMAIL: z.string().email(), // service account login email
  MCP_SERVICE_PASSWORD: z.string().min(8), // service account password
  MCP_ORGANIZATION_ID: z.string().uuid(),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error"])
    .default("info"),
  LOG_PRETTY: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
});
export type Config = z.infer<typeof ConfigSchema>;
```

### `src/auth/token-context.ts`

```typescript
export interface ToolContext {
  organizationId: string;
  accessToken: string; // freshly fetched; never stale
  correlationId: string; // UUID, fresh per tool call
}
// Calls tokenManager.getAccessToken() — silently refreshes if within 60s of expiry.
export async function buildToolContext(
  tokenManager,
  orgId,
): Promise<ToolContext>;
```

### `src/logger/logger.ts`

```typescript
export interface ToolLogContext {
  tool: string;
  organizationId: string;
  correlationId: string;
  durationMs?: number;
  resultStatus: "success" | "error";
  isMutating?: boolean; // true → emits ai_mutating_action: true in JSON log
}
export function logToolCall(ctx: ToolLogContext): void;
```

---

## Tool Catalog

| Tool                           | Method | Backend Endpoint         | Zod Input Highlights                                                        | Mutating |
| ------------------------------ | ------ | ------------------------ | --------------------------------------------------------------------------- | -------- |
| `search_orders`                | GET    | `/orders`                | `search?`, `status?`, `locationId?`, `limit`, `cursor?`                     | No       |
| `get_order_details`            | GET    | `/orders/:id`            | `id` (uuid)                                                                 | No       |
| `get_orders_for_customer`      | GET    | `/orders`                | `customerEmail` → forwarded as `search` param                               | No       |
| `check_inventory`              | GET    | `/inventory/levels`      | `productId?`, `locationId?`, `lowStockOnly?`                                | No       |
| `search_products`              | GET    | `/products`              | `search?`, `category?`, `isActive?`, `limit`, `cursor?`                     | No       |
| `propose_inventory_adjustment` | POST   | `/inventory/adjustments` | `productId`, `locationId`, `delta` (non-zero int), `reason` (enum), `note?` | **Yes**  |
| `list_low_stock_products`      | GET    | `/inventory`             | `lowStockOnly: true` hardcoded, `limit`, `cursor?`                          | No       |

**Note on `get_orders_for_customer`**: The backend's `GET /orders` has no `customerId` filter — only a freetext `search` param. The tool accepts `customerEmail` and forwards it as `search`. This is the correct mapping.

**Note on `propose_inventory_adjustment` (hardest tool)**:

- AI attribution is embedded in the `note` field: `[AI/MCP correlationId:<uuid>] <user note>` — no schema change needed.
- `isMutating: true` in the log call emits `ai_mutating_action: true` in JSON, making AI writes filterable in Loki/Grafana.
- `InventoryAdjustmentReason` Zod enum mirrors the backend's Prisma enum.

---

## Auth Flow per Tool Call

```
1. tool handler called by MCP host
2. await buildToolContext(tokenManager, orgId)
   └── tokenManager.getAccessToken()
       ├── token still valid (exp > now + 60s) → return cached token
       └── expired / missing → POST /auth/refresh { refreshTokenRaw, userId }
           └── store new accessToken + exp in memory → return
3. buildBackendHeaders(ctx)
   └── { Authorization: "Bearer <accessToken>", X-Organization-Id: "<orgId>", X-Request-Id: "<uuid>" }
4. axiosClient.get/post(path, { headers, params/body })
5. backend: JwtAuthGuard → OrganizationContextGuard → PermissionsGuard → handler
6. response → JSON.stringify → MCP content[{ type: 'text', text }]
7. logToolCall({ tool, orgId, correlationId, durationMs, resultStatus, isMutating? })
```

On error: `mapAxiosErrorToMcp(err)` maps HTTP status → `McpError(ErrorCode.*)`.
If `/auth/refresh` itself fails (refresh token expired/revoked), the error surfaces as `McpError(InternalError, "Token refresh failed — rotate MCP_REFRESH_TOKEN")`.

---

## Error Mapping

| Backend HTTP | McpError code              |
| ------------ | -------------------------- |
| 400          | `ErrorCode.InvalidParams`  |
| 401          | `ErrorCode.InvalidRequest` |
| 403          | `ErrorCode.InvalidRequest` |
| 404          | `ErrorCode.InvalidRequest` |
| 5xx          | `ErrorCode.InternalError`  |

---

## Claude Desktop Registration (local dev)

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ledgerlight": {
      "command": "node",
      "args": ["/Users/rawad663/Projects/ledgerlight/mcp-server/dist/index.js"],
      "env": {
        "BACKEND_URL": "http://localhost:8080",
        "MCP_SERVICE_EMAIL": "mcp-service@yourorg.com",
        "MCP_SERVICE_PASSWORD": "<service-account-password>",
        "MCP_ORGANIZATION_ID": "<org-uuid>",
        "LOG_LEVEL": "debug",
        "LOG_PRETTY": "true"
      }
    }
  }
}
```

**Setup**: Create a dedicated service account user in LedgerLight with a strong password. Assign it a membership in the target org with a role that has at minimum: `ORDERS_READ`, `PRODUCTS_READ`, `INVENTORY_READ`, `INVENTORY_ADJUST`, `CUSTOMERS_READ`. The `TokenManager` handles all login and token refresh automatically from there.

---

## Build Sequence

### Phase 1 — Scaffold

1. Create `mcp-server/` at repo root
2. Write `package.json`, `tsconfig.json`, `jest.config.ts`, `.env.example`
3. `npm install` in `mcp-server/`
4. Verify `ts-node src/index.ts` starts (empty server, no tools yet)

### Phase 2 — Core Infrastructure

5. `src/config.ts` — Zod env parsing (`MCP_SERVICE_EMAIL`, `MCP_SERVICE_PASSWORD`, `MCP_ORGANIZATION_ID`)
6. `src/logger/logger.ts` — pino instance + `logToolCall`
7. `src/auth/token-manager.ts` — three-tier `TokenManager` (login → refresh → cache)
8. `src/auth/token-context.ts` — `buildToolContext(tokenManager, orgId)` → `Promise<ToolContext>`
9. `src/auth/header-builder.ts` — `buildBackendHeaders`
10. `src/client/ledgerlight-client.ts` — Axios singleton
11. `src/client/error-mapper.ts` — `mapAxiosErrorToMcp`
12. `src/server.ts` + `src/index.ts` — McpServer + StdioServerTransport + TokenManager instantiation
13. Unit tests: `config.ts`, `token-manager.ts` (mock axios: test Tier 1 cache hit, Tier 2 refresh, Tier 2 failure → Tier 3 login), `error-mapper.ts`

### Phase 3 — Read-Only Tools (simplest → complex)

13. `list-low-stock-products.ts`
14. `search-products.ts`
15. `get-order-details.ts`
16. `search-orders.ts`
17. `get-orders-for-customer.ts`
18. `check-inventory.ts`

Each: implement → unit test → manual smoke with real backend.

### Phase 4 — Mutating Tool

19. `propose-inventory-adjustment.ts`
20. Unit tests: happy path, expired token, 400/403 from backend, `delta=0` rejected by Zod

### Phase 5 — Documentation

21. `docs/convensions/MCP_SERVER_CONVENTIONS.md`
22. `docs/MCP_SERVER.md`

### Phase 6 — AGENTS.md update

23. Add `mcp-server/` to the Repository Layout section and reference the two new docs

---

## Testing Strategy

### Unit tests (per tool, no network)

- Mock `getLedgerlightClient` to return a jest-mocked Axios instance
- Mock `TokenManager.getAccessToken()` to return a fake token (avoid real refresh calls)
- Assert: correct URL path, query params, headers (`Authorization`, `X-Organization-Id`, `X-Request-Id`)
- Assert: error codes for 400/401/403/404/5xx
- Assert: `propose_inventory_adjustment` note has `[AI/MCP correlationId:` prefix
- Assert: `logToolCall` called with `isMutating: true` for the mutating tool

### Unit tests for `TokenManager`

- Tier 1 hit: `getAccessToken()` called twice with valid state → no axios calls on second call
- Tier 2 hit: state has expired access token + valid refresh token → calls `/auth/refresh`, not `/auth/login`
- Tier 2 → Tier 3 fallback: `/auth/refresh` throws 401 → calls `/auth/login` next
- Tier 3 (first run): no state → calls `/auth/login`, stores refresh token + userId in memory
- Tier 3 failure: `/auth/login` throws → propagates as-is with a useful error message

### Integration (optional, real backend)

- Spawn `node dist/index.js` as a subprocess with real env vars
- Connect via MCP SDK `StdioClientTransport` + `Client`
- Call each tool and assert response shape
- Run after `make dev-build` and `make dev-seed`

---

## docs/convensions/MCP_SERVER_CONVENTIONS.md — Key Sections to Define

1. **Tool naming**: snake_case verbs (`search_orders`, not `getOrders`)
2. **Input schemas**: all Zod — no raw TypeScript types as schemas; every field must have `.describe()`
3. **No NestJS**: no `@Injectable`, no class-validator, no class-transformer
4. **One file per tool** in `src/tools/`; each exports a single `register<ToolName>(server, config)` function
5. **Token management**: never hold a token across calls — always `await buildToolContext(tokenManager, orgId)`; `TokenManager` handles login, refresh, and caching transparently via three tiers (cache → refresh → login)
6. **Auth forwarding**: every tool calls `buildToolContext` → `buildBackendHeaders`; never hardcode headers
7. **Correlation IDs**: `buildToolContext` generates a fresh UUID per call; pass it through `logToolCall`
8. **Error handling**: always `throw mapAxiosErrorToMcp(err)` — never return raw error strings; never swallow errors
9. **Mutating tools**: must set `isMutating: true` in `logToolCall`; must prefix `note` with `[AI/MCP correlationId:...]`
10. **Content format**: return `{ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }`
11. **Tests**: every tool ships a `.spec.ts`; mock `TokenManager.getAccessToken()` and the Axios layer — never make real network calls in unit tests

## docs/MCP_SERVER.md — Key Sections to Include

1. Purpose and capability surface (7 tools, why these)
2. Architecture diagram (text): Claude Desktop → stdio → MCP server → HTTP → LedgerLight backend → PostgreSQL
3. Auth flow (token + org header forwarding)
4. Request lifecycle (per-call correlation ID, logToolCall, error mapping)
5. Tool catalog (name, description, inputs, backend endpoint)
6. AI attribution pattern (note prefix, `ai_mutating_action` log field)
7. Local dev setup (env vars, build, Claude Desktop config)
8. Adding a new tool (checklist referencing conventions doc)
