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

export function registerListLowStockProducts(
  server: McpServer,
  config: Config,
  tokenManager: TokenManager,
): void {
  registerTool(
    server,
    "list_low_stock_products",
    {
      description:
        "List all products whose current stock is at or below their reorder threshold. " +
        "Returns aggregated inventory with per-location breakdown.",
      inputSchema: InputSchema as z.ZodTypeAny,
    },
    async (rawArgs) => {
      const { limit, cursor } = rawArgs as Input;
      const startMs = Date.now();
      const ctx = await buildToolContext(
        tokenManager,
        config.MCP_ORGANIZATION_ID,
      );

      try {
        const client = getLedgerlightClient(config);
        const response = await client.get("/inventory", {
          headers: buildBackendHeaders(ctx),
          params: { lowStockOnly: true, limit, cursor },
        });
        const data: unknown = response.data;

        logToolCall({
          tool: "list_low_stock_products",
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
          tool: "list_low_stock_products",
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
