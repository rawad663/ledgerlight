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
  productId: z.string().uuid().optional().describe("Filter by product UUID"),
  locationId: z.string().uuid().optional().describe("Filter by location UUID"),
  lowStockOnly: z
    .boolean()
    .optional()
    .describe(
      "When true, return only inventory levels where stock is at or below the reorder threshold",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe(
      "Maximum number of inventory levels to return (1–100, default 20)",
    ),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous response"),
});

type Input = z.infer<typeof InputSchema>;

export function registerCheckInventory(
  server: McpServer,
  config: Config,
  tokenManager: TokenManager,
): void {
  registerTool(
    server,
    "check_inventory",
    {
      description:
        "Check current inventory levels. Optionally filter by product, location, " +
        "or show only low-stock items. Returns quantity on hand with product and location context.",
      inputSchema: InputSchema as z.ZodTypeAny,
    },
    async (rawArgs) => {
      const { productId, locationId, lowStockOnly, limit, cursor } =
        rawArgs as Input;
      const startMs = Date.now();

      try {
        const ctx = await buildToolContext(
          tokenManager,
          config.MCP_ORGANIZATION_ID,
        );

        const client = getLedgerlightClient(config);
        const response = await client.get("/inventory/levels", {
          headers: buildBackendHeaders(ctx),
          params: { productId, locationId, lowStockOnly, limit, cursor },
        });
        const data: unknown = response.data;

        logToolCall({
          tool: "check_inventory",
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
          tool: "check_inventory",
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
