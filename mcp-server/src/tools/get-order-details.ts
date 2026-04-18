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
  id: z.string().uuid().describe("UUID of the order to retrieve"),
});

type Input = z.infer<typeof InputSchema>;

export function registerGetOrderDetails(
  server: McpServer,
  config: Config,
  tokenManager: TokenManager,
): void {
  registerTool(
    server,
    "get_order_details",
    {
      description:
        "Retrieve full details for a single order including all line items, " +
        "customer info, location, payment status, and order totals.",
      inputSchema: InputSchema as z.ZodTypeAny,
    },
    async (rawArgs) => {
      const { id } = rawArgs as Input;
      const startMs = Date.now();

      try {
        const ctx = await buildToolContext(
          tokenManager,
          config.MCP_ORGANIZATION_ID,
        );

        const client = getLedgerlightClient(config);
        const response = await client.get(`/orders/${id}`, {
          headers: buildBackendHeaders(ctx),
        });
        const data: unknown = response.data;

        logToolCall({
          tool: "get_order_details",
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
          tool: "get_order_details",
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
