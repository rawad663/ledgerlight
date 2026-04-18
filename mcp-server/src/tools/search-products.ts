import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config";
import type { TokenManager } from "../auth/token-manager";
import { buildToolContext } from "../auth/token-context";
import { buildBackendHeaders } from "../auth/header-builder";
import { getLedgerlightClient } from "../client/ledgerlight-client";
import { mapAxiosErrorToMcp } from "../client/error-mapper";
import { logToolCall } from "../logger/logger";
import { registerTool } from "./register-tool";

const InputSchema = z.object({
  search: z
    .string()
    .max(200)
    .optional()
    .describe("Search by product name or SKU"),
  category: z
    .string()
    .max(100)
    .optional()
    .describe("Filter by product category"),
  isActive: z
    .boolean()
    .optional()
    .describe("Filter by active status (omit to return all)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of products to return (1–100, default 20)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous response"),
});

type Input = z.infer<typeof InputSchema>;

export function registerSearchProducts(
  server: McpServer,
  config: Config,
  tokenManager: TokenManager,
): void {
  registerTool(
    server,
    "search_products",
    {
      description:
        "Search and filter the product catalog. Supports full-text search by name or SKU, " +
        "category filtering, and active/inactive filtering.",
      inputSchema: InputSchema as z.ZodTypeAny,
    },
    async (rawArgs) => {
      const { search, category, isActive, limit, cursor } = rawArgs as Input;
      const startMs = Date.now();

      try {
        const ctx = await buildToolContext(
          tokenManager,
          config.MCP_ORGANIZATION_ID,
        );

        const client = getLedgerlightClient(config);
        const response = await client.get("/products", {
          headers: buildBackendHeaders(ctx),
          params: { search, category, isActive, limit, cursor },
        });
        const data: unknown = response.data;

        logToolCall({
          tool: "search_products",
          organizationId: ctx.organizationId,
          correlationId: ctx.correlationId,
          durationMs: Date.now() - startMs,
          resultStatus: "success",
        });

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        logToolCall({
          tool: "search_products",
          organizationId: ctx.organizationId,
          correlationId: ctx.correlationId,
          durationMs: Date.now() - startMs,
          resultStatus: "error",
        });
        throw mapAxiosErrorToMcp(err);
      }
    },
  );
}
