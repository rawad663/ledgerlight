import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import {
  resolveBackendEnvFilePaths,
  resolveLedgerLightEnvironment,
} from './runtime-env';

describe('resolveLedgerLightEnvironment', () => {
  it('defaults to dev outside production', () => {
    delete process.env.LEDGERLIGHT_ENV;
    process.env.NODE_ENV = 'development';

    expect(resolveLedgerLightEnvironment()).toBe('dev');
  });

  it('defaults to prod in production mode', () => {
    delete process.env.LEDGERLIGHT_ENV;
    process.env.NODE_ENV = 'production';

    expect(resolveLedgerLightEnvironment()).toBe('prod');
  });

  it('prefers LEDGERLIGHT_ENV when set', () => {
    process.env.LEDGERLIGHT_ENV = 'qa';
    process.env.NODE_ENV = 'development';

    expect(resolveLedgerLightEnvironment()).toBe('qa');
  });
});

describe('resolveBackendEnvFilePaths', () => {
  it('finds the root env file when running from backend/', () => {
    const repoRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ledgerlight-backend-env-'),
    );
    const backendRoot = path.join(repoRoot, 'backend');

    fs.mkdirSync(backendRoot);
    fs.writeFileSync(path.join(repoRoot, '.env.dev'), 'STRIPE_SECRET_KEY=test');

    expect(
      resolveBackendEnvFilePaths({ environment: 'dev', cwd: backendRoot }),
    ).toEqual([path.join(repoRoot, '.env.dev')]);
  });

  it('includes a local legacy .env file when present', () => {
    const backendRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ledgerlight-backend-env-'),
    );
    fs.writeFileSync(path.join(backendRoot, '.env'), 'JWT_ACCESS_SECRET=test');

    expect(
      resolveBackendEnvFilePaths({ environment: 'dev', cwd: backendRoot }),
    ).toEqual([path.join(backendRoot, '.env')]);
  });

  it('returns an empty list when no env files are present', () => {
    const backendRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ledgerlight-backend-env-'),
    );

    expect(
      resolveBackendEnvFilePaths({ environment: 'dev', cwd: backendRoot }),
    ).toEqual([]);
  });
});
