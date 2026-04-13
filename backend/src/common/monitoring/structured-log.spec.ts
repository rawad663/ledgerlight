import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeStructuredLog } from './structured-log';

describe('writeStructuredLog', () => {
  const originalLogFilePath = process.env.LOG_FILE_PATH;
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  let tempDir: string | null = null;

  afterEach(() => {
    logSpy.mockClear();

    if (originalLogFilePath === undefined) {
      delete process.env.LOG_FILE_PATH;
    } else {
      process.env.LOG_FILE_PATH = originalLogFilePath;
    }

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  afterAll(() => {
    logSpy.mockRestore();
  });

  it('writes structured entries to stdout and the configured ndjson file', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'structured-log-'));
    const logFilePath = join(tempDir, 'nested', 'backend.ndjson');

    process.env.LOG_FILE_PATH = logFilePath;

    writeStructuredLog('info', 'http', {
      message: 'request_completed',
      request_id: 'req-1',
      route: '/products',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(existsSync(logFilePath)).toBe(true);

    const payload = JSON.parse(readFileSync(logFilePath, 'utf8').trim());

    expect(payload).toMatchObject({
      level: 'info',
      context: 'http',
      message: 'request_completed',
      request_id: 'req-1',
      route: '/products',
    });
    expect(payload.timestamp).toEqual(expect.any(String));
  });
});
