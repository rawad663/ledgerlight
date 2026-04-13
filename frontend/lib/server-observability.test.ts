import { describe, expect, it, vi } from "vitest";

import {
  buildCorrelationHeaders,
  getOrCreateRequestId,
} from "@/lib/server-observability";

describe("server observability helpers", () => {
  it("reuses an incoming request id when present", () => {
    const requestId = getOrCreateRequestId(
      new Headers({ "X-Request-Id": "req-123" }),
    );

    expect(requestId).toBe("req-123");
  });

  it("creates a request id when one is not present", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("generated-id");

    expect(getOrCreateRequestId(new Headers())).toBe("generated-id");
  });

  it("merges correlation headers into outgoing request headers", () => {
    const { headers } = buildCorrelationHeaders(
      new Headers({
        "X-Request-Id": "req-456",
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
      }),
      {
        Authorization: "Bearer token",
      },
    );

    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("X-Request-Id")).toBe("req-456");
    expect(headers.get("traceparent")).toContain("4bf92f3577b34da6");
  });
});
