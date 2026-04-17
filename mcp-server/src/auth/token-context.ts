import { randomUUID } from "node:crypto";
import type { TokenManager } from "./token-manager";

export interface ToolContext {
  organizationId: string;
  accessToken: string;
  correlationId: string;
}

export async function buildToolContext(
  tokenManager: TokenManager,
  organizationId: string,
): Promise<ToolContext> {
  const accessToken = await tokenManager.getAccessToken();
  return { organizationId, accessToken, correlationId: randomUUID() };
}
