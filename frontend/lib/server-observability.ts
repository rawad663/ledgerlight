const REQUEST_ID_HEADER = "X-Request-Id";
const TRACE_HEADERS = ["traceparent", "tracestate"] as const;

type HeaderSource = Pick<Headers, "get">;

function createRequestId() {
  return crypto.randomUUID();
}

export function getOrCreateRequestId(source?: HeaderSource) {
  return (
    source?.get(REQUEST_ID_HEADER) ??
    source?.get(REQUEST_ID_HEADER.toLowerCase()) ??
    createRequestId()
  );
}

export function buildCorrelationHeaders(
  source?: HeaderSource,
  initialHeaders?: HeadersInit,
) {
  const headers = new Headers(initialHeaders);
  const requestId = getOrCreateRequestId(source);

  headers.set(REQUEST_ID_HEADER, requestId);

  for (const headerName of TRACE_HEADERS) {
    const value = source?.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return { headers, requestId };
}
