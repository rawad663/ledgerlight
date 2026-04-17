import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import axios, { type AxiosError } from "axios";

type BackendErrorBody = {
  statusCode?: number;
  message?: string | string[];
  requestId?: string;
};

export function mapAxiosErrorToMcp(error: unknown): McpError {
  if (!axios.isAxiosError(error)) {
    const msg = error instanceof Error ? error.message : String(error);
    return new McpError(ErrorCode.InternalError, msg);
  }

  const axiosError = error as AxiosError<BackendErrorBody>;
  const status = axiosError.response?.status ?? 0;
  const body = axiosError.response?.data;
  const rawMessage = Array.isArray(body?.message)
    ? body.message.join("; ")
    : (body?.message ?? axiosError.message);

  if (status === 401) {
    return new McpError(
      ErrorCode.InvalidRequest,
      `Authentication failed: ${rawMessage}`,
    );
  }
  if (status === 403) {
    return new McpError(ErrorCode.InvalidRequest, `Forbidden: ${rawMessage}`);
  }
  if (status === 404) {
    return new McpError(ErrorCode.InvalidRequest, `Not found: ${rawMessage}`);
  }
  if (status === 400) {
    return new McpError(
      ErrorCode.InvalidParams,
      `Validation error: ${rawMessage}`,
    );
  }
  if (status >= 500) {
    return new McpError(
      ErrorCode.InternalError,
      `Backend error (${status}): ${rawMessage}`,
    );
  }

  return new McpError(ErrorCode.InternalError, rawMessage);
}
