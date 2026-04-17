import pino, { type Logger } from "pino";
import type { Config } from "../config";

let _logger: Logger | null = null;

export function getLogger(config?: Config): Logger {
  if (_logger) return _logger;

  const level =
    config?.LOG_LEVEL ??
    (process.env.LOG_LEVEL as Config["LOG_LEVEL"] | undefined) ??
    "info";

  const options = {
    level,
    base: { service: "ledgerlight-mcp" },
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
  };

  const pretty =
    config?.LOG_PRETTY === true || process.env.LOG_PRETTY === "true";

  _logger = pretty
    ? pino({
        ...options,
        transport: {
          target: "pino-pretty",
          options: { colorize: true, destination: 2 },
        },
      })
    : pino(options, pino.destination(2));

  return _logger;
}

export interface ToolLogContext {
  tool: string;
  organizationId: string;
  correlationId: string;
  durationMs?: number;
  resultStatus: "success" | "error";
  isMutating?: boolean;
}

export function logToolCall(ctx: ToolLogContext): void {
  const logger = getLogger();
  const level = ctx.resultStatus === "error" ? "warn" : "info";

  logger[level]({
    event: "tool_call",
    ...ctx,
    ...(ctx.isMutating ? { ai_mutating_action: true } : {}),
  });
}
