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
  customerEmail: z.string().email().describe("The customer's email address"),
  status: z
    .enum(["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"])
    .optional()
    .describe("Optionally filter by order status"),
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

export function registerGetOrdersForCustomer(
  server: McpServer,
  config: Config,
  tokenManager: TokenManager,
): void {
  registerTool(
    server,
    "get_orders_for_customer",
    {
      description:
        "Retrieve all orders placed by a specific customer, identified by their email address. " +
        "Returns orders sorted by most recent first.",
      inputSchema: InputSchema as z.ZodTypeAny,
    },
    async (rawArgs) => {
      const { customerEmail, status, limit, cursor } = rawArgs as Input;
      const startMs = Date.now();

      try {
        const ctx = await buildToolContext(
          tokenManager,
          config.MCP_ORGANIZATION_ID,
        );

        const client = getLedgerlightClient(config);
        // The backend's GET /orders `search` param matches customer email
        const response = await client.get("/orders", {
          headers: buildBackendHeaders(ctx),
          params: { search: customerEmail, status, limit, cursor },
        });
        const data: unknown = response.data;

        logToolCall({
          tool: "get_orders_for_customer",
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
          tool: "get_orders_for_customer",
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
