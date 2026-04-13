import { randomUUID } from 'node:crypto';
import {
  RequestContextMiddleware,
  REQUEST_HEADER,
} from './request-context.middleware';

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(),
}));

describe('RequestContextMiddleware', () => {
  const middleware = new RequestContextMiddleware();
  const next = jest.fn();
  const setHeader = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reuses an incoming request id header', () => {
    const req = {
      get: jest.fn().mockReturnValue('req-123'),
    } as any;
    const res = { setHeader } as any;

    middleware.use(req, res, next);

    expect(req.get).toHaveBeenCalledWith(REQUEST_HEADER);
    expect(req.requestId).toBe('req-123');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'req-123');
    expect(next).toHaveBeenCalled();
  });

  it('creates a request id when the header is missing', () => {
    (randomUUID as jest.Mock).mockReturnValue('generated-req-id');

    const req = {
      get: jest.fn().mockReturnValue(undefined),
    } as any;
    const res = { setHeader } as any;

    middleware.use(req, res, next);

    expect(req.requestId).toBe('generated-req-id');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'generated-req-id');
    expect(typeof req.startTime).toBe('bigint');
  });
});
