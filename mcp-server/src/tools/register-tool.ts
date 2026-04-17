import type {
  ToolAnnotations,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type ToolRegistrationConfig = {
  title?: string;
  description?: string;
  inputSchema?: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
  annotations?: ToolAnnotations;
  _meta?: Record<string, unknown>;
};

type ToolHandler = (
  rawArgs: unknown,
  extra: unknown,
) => CallToolResult | Promise<CallToolResult>;

type RegisterToolFn = (
  name: string,
  config: ToolRegistrationConfig,
  handler: ToolHandler,
) => void;

// The MCP SDK's registerTool generic can trigger TS2589 with Zod-heavy inputs.
// Keep the SDK boundary untyped here, then restore local types inside each handler.
export function registerTool(
  server: McpServer,
  name: string,
  config: ToolRegistrationConfig,
  handler: ToolHandler,
): void {
  const unsafeRegisterTool = server.registerTool.bind(server) as RegisterToolFn;
  unsafeRegisterTool(name, config, handler);
}
