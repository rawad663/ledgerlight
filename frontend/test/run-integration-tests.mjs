import { spawn } from "node:child_process";
import process from "node:process";

const DEFAULT_APP_PORT = process.env.FRONTEND_INTEGRATION_APP_PORT ?? "3005";
const DEFAULT_MOCK_PORT = process.env.FRONTEND_INTEGRATION_MOCK_PORT ?? "4011";
const HOST = "127.0.0.1";
const FRONTEND_BASE_URL = `http://${HOST}:${DEFAULT_APP_PORT}`;
const MOCK_API_BASE_URL = `http://${HOST}:${DEFAULT_MOCK_PORT}`;
const skipBuild = process.argv.includes("--skip-build");
const playwrightArgs = process.argv
  .slice(2)
  .filter((arg) => arg !== "--skip-build");
const children = [];

function getExecutable(name) {
  if (process.platform === "win32") {
    return `${name}.cmd`;
  }

  return name;
}

function spawnCommand(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    ...options,
  });

  children.push(child);

  return child;
}

async function runCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code ?? "null"}`,
        ),
      );
    });
  });
}

async function waitForUrl(url, label, timeoutMs = 60_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until the service becomes reachable.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

async function shutdownChildren() {
  const shutdowns = children.map(
    (child) =>
      new Promise((resolve) => {
        if (child.exitCode !== null || child.killed) {
          resolve(undefined);
          return;
        }

        const timer = setTimeout(() => {
          child.kill("SIGKILL");
        }, 5_000);

        child.once("exit", () => {
          clearTimeout(timer);
          resolve(undefined);
        });

        child.kill("SIGTERM");
      }),
  );

  await Promise.allSettled(shutdowns);
}

async function main() {
  const baseEnv = {
    ...process.env,
    NEXT_PUBLIC_API_URL: MOCK_API_BASE_URL,
  };

  if (!skipBuild) {
    await runCommand(getExecutable("npm"), ["run", "build"], {
      env: baseEnv,
    });
  }

  const mockServer = spawnCommand("node", ["./test/integration/mock-server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MOCK_API_PORT: DEFAULT_MOCK_PORT,
      FRONTEND_BASE_URL,
    },
  });

  mockServer.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Mock API server exited early with code ${code}`);
    }
  });

  await waitForUrl(`${MOCK_API_BASE_URL}/__health`, "mock API");

  const nextServer = spawnCommand(getExecutable("npm"), [
    "run",
    "start",
    "--",
    "--hostname",
    HOST,
    "--port",
    DEFAULT_APP_PORT,
  ], {
    cwd: process.cwd(),
    env: {
      ...baseEnv,
      PORT: DEFAULT_APP_PORT,
    },
  });

  nextServer.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Next.js server exited early with code ${code}`);
    }
  });

  await waitForUrl(`${FRONTEND_BASE_URL}/login`, "frontend app");

  await runCommand(
    getExecutable("npx"),
    ["playwright", "test", ...playwrightArgs],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: FRONTEND_BASE_URL,
        MOCK_API_BASE_URL,
      },
    },
  );
}

process.on("SIGINT", async () => {
  await shutdownChildren();
  process.exit(130);
});

process.on("SIGTERM", async () => {
  await shutdownChildren();
  process.exit(143);
});

try {
  await main();
} finally {
  await shutdownChildren();
}
