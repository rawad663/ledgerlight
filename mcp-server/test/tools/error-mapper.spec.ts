import axios from "axios";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { mapAxiosErrorToMcp } from "../../src/client/error-mapper";

// axios.isAxiosError needs to work in tests
jest.mock("axios", () => {
  const actual = jest.requireActual<typeof axios>("axios");
  return { ...actual };
});

function makeAxiosError(status: number, message: string | string[]) {
  const err = new Error(
    Array.isArray(message) ? message[0] : message,
  ) as Error & {
    isAxiosError: boolean;
    response: { status: number; data: { message: string | string[] } };
  };
  err.isAxiosError = true;
  err.response = { status, data: { message } };
  // Make axios.isAxiosError return true
  Object.defineProperty(err, "isAxiosError", { value: true });
  return err;
}

describe("mapAxiosErrorToMcp", () => {
  it("maps 400 → InvalidParams", () => {
    const err = makeAxiosError(400, "delta must be non-zero");
    const mapped = mapAxiosErrorToMcp(err);
    expect(mapped.code).toBe(ErrorCode.InvalidParams);
    expect(mapped.message).toContain("delta must be non-zero");
  });

  it("maps 401 → InvalidRequest", () => {
    const err = makeAxiosError(401, "Unauthorized");
    const mapped = mapAxiosErrorToMcp(err);
    expect(mapped.code).toBe(ErrorCode.InvalidRequest);
  });

  it("maps 403 → InvalidRequest", () => {
    const err = makeAxiosError(403, "Forbidden");
    const mapped = mapAxiosErrorToMcp(err);
    expect(mapped.code).toBe(ErrorCode.InvalidRequest);
  });

  it("maps 404 → InvalidRequest", () => {
    const err = makeAxiosError(404, "Not found");
    const mapped = mapAxiosErrorToMcp(err);
    expect(mapped.code).toBe(ErrorCode.InvalidRequest);
  });

  it("maps 500 → InternalError", () => {
    const err = makeAxiosError(500, "Internal server error");
    const mapped = mapAxiosErrorToMcp(err);
    expect(mapped.code).toBe(ErrorCode.InternalError);
  });

  it("joins array messages with semicolons for 400", () => {
    const err = makeAxiosError(400, [
      "field a is required",
      "field b is invalid",
    ]);
    const mapped = mapAxiosErrorToMcp(err);
    expect(mapped.message).toContain("field a is required");
    expect(mapped.message).toContain("field b is invalid");
  });

  it("maps non-axios errors → InternalError", () => {
    const mapped = mapAxiosErrorToMcp(new Error("something unexpected"));
    expect(mapped.code).toBe(ErrorCode.InternalError);
    expect(mapped.message).toContain("something unexpected");
  });
});
