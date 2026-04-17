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

// Mirrors InventoryAjustmentReason enum in schema.prisma
const AdjustmentReasonSchema = z.enum([
  "MANUAL",
  "RESTOCK",
  "SALE",
  "RETURN",
  "SHRINKAGE",
  "COUNT_CORRECTION",
  "INITIAL_STOCK",
  "ADJUSTMENT",
  "DAMAGED",
  "LOST",
  "FOUND",
  "CORRECTION",
]);

const InputSchema = z.object({
  productId: z
    .string()
    .uuid()
    .describe("UUID of the product whose stock is being adjusted"),
  locationId: z
    .string()
    .uuid()
    .describe("UUID of the location where the adjustment applies"),
  delta: z
    .number()
    .int()
    .refine((n) => n !== 0, { message: "delta must be non-zero" })
    .describe(
      "Signed integer quantity change: positive to add stock, negative to remove",
    ),
  reason: AdjustmentReasonSchema.describe(
    "Category for the adjustment (e.g. RESTOCK, SHRINKAGE, COUNT_CORRECTION)",
  ),
  note: z
    .string()
    .max(500)
    .optional()
    .describe(
      "Optional free-text note explaining why the adjustment is needed",
    ),
});

type Input = z.infer<typeof InputSchema>;

export function registerProposeInventoryAdjustment(
  server: McpServer,
  config: Config,
  tokenManager: TokenManager,
): void {
  registerTool(
    server,
    "propose_inventory_adjustment",
    {
      description:
        "Adjust inventory stock level for a product at a specific location. " +
        "Positive delta adds stock (e.g. restocking); negative delta removes stock (e.g. damage or loss). " +
        "This is a mutating operation — every call is recorded in audit logs as an AI-originated action.",
      inputSchema: InputSchema as z.ZodTypeAny,
    },
    async (rawArgs) => {
      const { productId, locationId, delta, reason, note } = rawArgs as Input;
      const startMs = Date.now();
      const ctx = await buildToolContext(
        tokenManager,
        config.MCP_ORGANIZATION_ID,
      );

      // Prefix the note with AI/MCP attribution so it's identifiable in
      // adjustment records and audit logs without requiring a schema change.
      const aiNote = [`[AI/MCP correlationId:${ctx.correlationId}]`, note]
        .filter(Boolean)
        .join(" ");

      const payload = { productId, locationId, delta, reason, note: aiNote };

      try {
        const client = getLedgerlightClient(config);
        const response = await client.post("/inventory/adjustments", payload, {
          headers: buildBackendHeaders(ctx),
        });
        const data: unknown = response.data;

        logToolCall({
          tool: "propose_inventory_adjustment",
          organizationId: ctx.organizationId,
          correlationId: ctx.correlationId,
          durationMs: Date.now() - startMs,
          resultStatus: "success",
          isMutating: true,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        logToolCall({
          tool: "propose_inventory_adjustment",
          organizationId: ctx.organizationId,
          correlationId: ctx.correlationId,
          durationMs: Date.now() - startMs,
          resultStatus: "error",
          isMutating: true,
        });
        throw mapAxiosErrorToMcp(err);
      }
    },
  );
}
