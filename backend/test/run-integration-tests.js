const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const composeFile = path.join(backendRoot, 'test', 'docker-compose.integration.yml');
const prismaBin = path.join(
  backendRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);
const jestBin = path.join(
  backendRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'jest.cmd' : 'jest',
);

function runCommand(command, args, options) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited with status ${result.status ?? 1}`,
    );
  }
}

function teardownDocker(projectName, env) {
  spawnSync(
    'docker',
    ['compose', '-f', composeFile, '-p', projectName, 'down', '-v', '--remove-orphans'],
    {
      cwd: repoRoot,
      env,
      stdio: 'inherit',
    },
  );
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to resolve an ephemeral test DB port')));
        return;
      }

      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function main() {
  const port = await getAvailablePort();
  const projectName = `ledgerlight-int-${crypto.randomUUID().slice(0, 8)}`;
  const databaseName = `ledgerlight_integration_${Date.now()}`;
  const dockerEnv = {
    ...process.env,
    POSTGRES_USER: 'postgres',
    POSTGRES_PASSWORD: 'postgres',
    POSTGRES_DB: databaseName,
    TEST_DB_PORT: String(port),
  };
  const testEnv = {
    ...process.env,
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${port}/${databaseName}?schema=public`,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'integration-test-secret',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    NODE_ENV: 'test',
    NODE_OPTIONS: [
      process.env.NODE_OPTIONS,
      '--experimental-vm-modules',
    ]
      .filter(Boolean)
      .join(' '),
  };

  try {
    runCommand(
      'docker',
      ['compose', '-f', composeFile, '-p', projectName, 'up', '-d', '--wait'],
      {
        cwd: repoRoot,
        env: dockerEnv,
      },
    );

    runCommand(prismaBin, ['migrate', 'deploy'], {
      cwd: backendRoot,
      env: testEnv,
    });

    runCommand(
      jestBin,
      ['--config', './test/jest-integration.json', '--runInBand', ...process.argv.slice(2)],
      {
        cwd: backendRoot,
        env: testEnv,
      },
    );
  } finally {
    teardownDocker(projectName, dockerEnv);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
