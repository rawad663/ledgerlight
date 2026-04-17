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
    .describe("Search by order ID, customer name, or customer email"),
  status: z
    .enum(["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"])
    .optional()
    .describe("Filter by order status"),
  locationId: z.string().uuid().optional().describe("Filter by location UUID"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of orders to return (1–100, default 20)"),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous response"),
});

type Input = z.infer<typeof InputSchema>;

export function registerSearchOrders(
  server: McpServer,
  config: Config,
  tokenManager: TokenManager,
): void {
  registerTool(
    server,
    "search_orders",
    {
      description:
        "Search and filter orders. Supports full-text search by order ID, " +
        "customer name, or customer email, and optional status and location filters.",
      inputSchema: InputSchema as z.ZodTypeAny,
    },
    async (rawArgs) => {
      const { search, status, locationId, limit, cursor } = rawArgs as Input;
      const startMs = Date.now();
      const ctx = await buildToolContext(
        tokenManager,
        config.MCP_ORGANIZATION_ID,
      );

      try {
        const client = getLedgerlightClient(config);
        const response = await client.get("/orders", {
          headers: buildBackendHeaders(ctx),
          params: { search, status, locationId, limit, cursor },
        });
        const data: unknown = response.data;

        logToolCall({
          tool: "search_orders",
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
          tool: "search_orders",
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
