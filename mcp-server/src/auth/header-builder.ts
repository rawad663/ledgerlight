import type { ToolContext } from "./token-context";

export interface BackendHeaders {
  [key: string]: string;
  Authorization: string;
  "X-Organization-Id": string;
  "X-Request-Id": string;
}

export function buildBackendHeaders(ctx: ToolContext): BackendHeaders {
  return {
    Authorization: `Bearer ${ctx.accessToken}`,
    "X-Organization-Id": ctx.organizationId,
    "X-Request-Id": ctx.correlationId,
  };
}
