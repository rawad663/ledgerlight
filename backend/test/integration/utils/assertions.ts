type ErrorBody = {
  statusCode?: number;
  message?: string | string[];
  path?: string;
  requestId?: string;
  timestamp?: string;
  resourceId?: string | string[];
};

export function expectErrorResponse(
  body: ErrorBody,
  args: {
    statusCode: number;
    path: string;
    message?: string | string[];
    resourceId?: string | string[];
  },
) {
  expect(body.statusCode).toBe(args.statusCode);
  if (args.message !== undefined) {
    expect(body.message).toEqual(args.message);
  }
  if (args.resourceId !== undefined) {
    expect(body.resourceId).toEqual(args.resourceId);
  }
  expect(body.path).toBe(args.path);
  expect(typeof body.requestId).toBe('string');
  expect(body.requestId).toBeTruthy();
  expect(typeof body.timestamp).toBe('string');
  expect(Number.isNaN(Date.parse(body.timestamp ?? ''))).toBe(false);
}
