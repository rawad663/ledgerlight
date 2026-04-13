import { of } from 'rxjs';
import { ExecutionContext } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  const interceptor = new LoggingInterceptor();
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  afterEach(() => {
    logSpy.mockClear();
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  it('logs structured request metadata without request or response body previews', (done) => {
    const req = {
      method: 'GET',
      baseUrl: '/orders',
      route: { path: '/:id' },
      originalUrl: '/orders/ord-1',
      requestId: 'req-1',
      startTime: process.hrtime.bigint(),
      user: { id: 'user-1' },
      organization: { organizationId: 'org-1' },
      query: {},
    };
    const res = { statusCode: 200 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as ExecutionContext;

    interceptor
      .intercept(context, {
        handle: () => of({ accessToken: 'secret', refreshTokenRaw: 'secret' }),
      })
      .subscribe({
        complete: () => {
          expect(logSpy).toHaveBeenCalledTimes(1);
          const payload = JSON.parse(logSpy.mock.calls[0][0] as string);

          expect(payload.message).toBe('request_completed');
          expect(payload.request_id).toBe('req-1');
          expect(payload.route).toBe('/orders/:id');
          expect(payload.user_id).toBe('user-1');
          expect(payload.organization_id).toBe('org-1');
          expect(payload.reqBody).toBeUndefined();
          expect(payload.resBody).toBeUndefined();
          done();
        },
      });
  });
});
