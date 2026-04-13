#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import process from "node:process";

const defaults = {
  apiBaseUrl: "http://localhost:8081",
  frontendBaseUrl: "http://localhost:3000",
  prometheusUrl: "http://localhost:9090",
  grafanaUrl: "http://localhost:3001",
  lokiUrl: "http://localhost:3100",
  tempoUrl: "http://localhost:3200",
  composeProject: "ledgerlight-qa",
  envFile: ".env.qa",
  waitMs: 20_000,
  skipFrontend: false,
  grafanaUser: process.env.GRAFANA_USER ?? "admin",
  grafanaPassword: process.env.GRAFANA_PASSWORD ?? "admin",
};

function parseArgs(argv) {
  const options = { ...defaults };

  for (const arg of argv) {
    if (arg === "--skip-frontend") {
      options.skipFrontend = true;
      continue;
    }

    const [flag, value] = arg.split("=", 2);
    if (!value) {
      throw new Error(`Unsupported argument: ${arg}`);
    }

    switch (flag) {
      case "--api-base-url":
        options.apiBaseUrl = value;
        break;
      case "--frontend-base-url":
        options.frontendBaseUrl = value;
        break;
      case "--prometheus-url":
        options.prometheusUrl = value;
        break;
      case "--grafana-url":
        options.grafanaUrl = value;
        break;
      case "--loki-url":
        options.lokiUrl = value;
        break;
      case "--tempo-url":
        options.tempoUrl = value;
        break;
      case "--compose-project":
        options.composeProject = value;
        break;
      case "--env-file":
        options.envFile = value;
        break;
      case "--wait-ms":
        options.waitMs = Number.parseInt(value, 10);
        break;
      default:
        throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.waitMs) || options.waitMs < 0) {
    throw new Error(`Invalid --wait-ms value: ${options.waitMs}`);
  }

  return options;
}

function composeArgs(options, ...extraArgs) {
  return [
    "compose",
    "--env-file",
    options.envFile,
    "-f",
    "docker-compose.yml",
    "-f",
    "docker-compose.qa.yml",
    "-p",
    options.composeProject,
    ...extraArgs,
  ];
}

function runCommand(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

async function waitForHttp(url, label, timeoutMs = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Keep polling.
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { response, data, text };
}

function printStep(message) {
  console.log(`\n==> ${message}`);
}

function printResult(message) {
  console.log(`  - ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAuthHeaders(accessToken, organizationId, requestId) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Organization-Id": organizationId,
    "X-Request-Id": requestId,
  };
}

async function verifyPrometheusTargets(options) {
  const { data } = await requestJson(`${options.prometheusUrl}/api/v1/targets`);
  const targets = data?.data?.activeTargets ?? [];
  const expectedJobs = ["backend", "otel-collector", "postgres-exporter"];

  for (const job of expectedJobs) {
    const target = targets.find((candidate) => candidate.labels?.job === job);
    assert(target, `Prometheus target ${job} was not found`);
    assert(target.health === "up", `Prometheus target ${job} is ${target.health}`);
  }
}

function buildLokiQuery(requestId) {
  const params = new URLSearchParams({
    query: `{service_name="ledger-light-backend"} | json | attributes_request_id="${requestId}"`,
    start: String((Date.now() - 60 * 60 * 1000) * 1_000_000),
    end: String(Date.now() * 1_000_000),
    limit: "5",
  });

  return `${defaults.lokiUrl}/loki/api/v1/query_range?${params.toString()}`;
}

async function queryLoki(lokiUrl, requestId) {
  const params = new URLSearchParams({
    query: `{service_name="ledger-light-backend"} | json | attributes_request_id="${requestId}"`,
    start: String((Date.now() - 60 * 60 * 1000) * 1_000_000),
    end: String(Date.now() * 1_000_000),
    limit: "5",
  });
  const { data } = await requestJson(`${lokiUrl}/loki/api/v1/query_range?${params}`);
  const results = data?.data?.result ?? [];
  assert(results.length > 0, `Loki returned no log lines for ${requestId}`);

  const stream = results[0].stream ?? {};
  const traceId = stream.attributes_trace_id;

  assert(traceId, `Loki did not expose a trace id for ${requestId}`);

  return {
    requestId,
    traceId,
    route: stream.attributes_route ?? null,
    statusCode: stream.attributes_status_code ?? null,
  };
}

async function verifyTempoTrace(tempoUrl, traceId, requestId) {
  const { text } = await requestJson(`${tempoUrl}/api/traces/${traceId}`);
  assert(
    text.includes("app.request_id"),
    `Tempo trace ${traceId} is missing app.request_id`,
  );
  assert(text.includes(requestId), `Tempo trace ${traceId} does not contain ${requestId}`);
}

async function verifyGrafanaDashboard(options) {
  const auth = Buffer.from(`${options.grafanaUser}:${options.grafanaPassword}`).toString("base64");
  const { data } = await requestJson(`${options.grafanaUrl}/api/search?query=Ledger%20Light%20QA%20Observability`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  assert(Array.isArray(data), "Grafana search did not return an array");
  assert(
    data.some((entry) => entry.uid === "ledgerlight-qa-observability"),
    "Grafana dashboard Ledger Light QA Observability was not found",
  );
}

function verifyBackendLogFile(options, requestIds) {
  const logOutput = runCommand("docker", composeArgs(
    options,
    "exec",
    "-T",
    "backend",
    "sh",
    "-lc",
    "test -f /var/log/ledgerlight/backend.ndjson && cat /var/log/ledgerlight/backend.ndjson",
  ));

  for (const requestId of requestIds) {
    assert(
      logOutput.includes(requestId),
      `backend.ndjson does not contain ${requestId}`,
    );
  }
}

function getSeededQaEmail(options) {
  return runCommand(
    "docker",
    composeArgs(
      options,
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "postgres",
      "-d",
      "ledgerlight_demo",
      "-At",
      "-c",
      'select email from "User" order by email limit 1;',
    ),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  printStep("Checking prerequisite services");
  await waitForHttp(`${options.apiBaseUrl}/health/live`, "QA backend");
  await waitForHttp(`${options.prometheusUrl}/-/ready`, "Prometheus");
  await waitForHttp(`${options.grafanaUrl}/api/health`, "Grafana");

  if (!options.skipFrontend) {
    await waitForHttp(`${options.frontendBaseUrl}/login`, "QA frontend");
  }

  printStep("Selecting a seeded QA user");
  const qaEmail = getSeededQaEmail(options);
  assert(qaEmail, "Could not find a seeded QA user");
  printResult(`qa user: ${qaEmail}`);

  printStep("Generating backend smoke traffic");
  await fetch(`${options.apiBaseUrl}/health/live`);
  await fetch(`${options.apiBaseUrl}/health/ready`);

  const loginFail = await requestJson(`${options.apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": "monitoring-login-fail-1",
    },
    body: JSON.stringify({ email: qaEmail, password: "WrongPass123!" }),
  });
  assert(loginFail.response.status === 401, `Expected failed login to return 401, got ${loginFail.response.status}`);

  const refreshFail = await requestJson(`${options.apiBaseUrl}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": "monitoring-refresh-fail-1",
    },
    body: JSON.stringify({
      userId: "00000000-0000-0000-0000-000000000000",
      refreshTokenRaw: "invalid",
    }),
  });
  assert(refreshFail.response.status === 401, `Expected failed refresh to return 401, got ${refreshFail.response.status}`);

  const loginOk = await requestJson(`${options.apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": "monitoring-login-ok-1",
    },
    body: JSON.stringify({ email: qaEmail, password: "DemoPass123!" }),
  });
  assert(loginOk.response.ok, `Expected successful backend login, got ${loginOk.response.status}`);

  const accessToken = loginOk.data?.accessToken;
  const organizationId = loginOk.data?.memberships?.[0]?.organizationId;

  assert(accessToken, "Backend login response did not include accessToken");
  assert(organizationId, "Backend login response did not include organizationId");
  printResult(`organization id: ${organizationId}`);

  const backendChecks = [
    [`${options.apiBaseUrl}/products?search=a&limit=5`, "monitoring-products-1"],
    [`${options.apiBaseUrl}/orders?search=a&status=PENDING&limit=5`, "monitoring-orders-1"],
    [`${options.apiBaseUrl}/inventory/levels?search=a&limit=5`, "monitoring-inventory-1"],
  ];

  for (const [url, requestId] of backendChecks) {
    const { response } = await requestJson(url, {
      headers: getAuthHeaders(accessToken, organizationId, requestId),
    });
    assert(response.ok, `${requestId} failed with ${response.status}`);
  }

  if (!options.skipFrontend) {
    printStep("Generating frontend-through-Next.js smoke traffic");
    const loginResponse = await fetch(`${options.frontendBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": "monitoring-fe-login-1",
      },
      body: JSON.stringify({ email: qaEmail, password: "DemoPass123!" }),
      redirect: "manual",
    });
    assert(loginResponse.ok, `Expected successful frontend login, got ${loginResponse.status}`);

    const setCookie = loginResponse.headers.getSetCookie?.() ?? [];
    assert(setCookie.length > 0, "Frontend login did not return cookies");
    const cookieHeader = setCookie.map((cookie) => cookie.split(";", 1)[0]).join("; ");

    const frontendChecks = [
      [`${options.frontendBaseUrl}/products?search=a`, "monitoring-fe-products-1"],
      [`${options.frontendBaseUrl}/orders?search=a&status=PENDING`, "monitoring-fe-orders-1"],
      [`${options.frontendBaseUrl}/inventory?search=a`, "monitoring-fe-inventory-1"],
    ];

    for (const [url, requestId] of frontendChecks) {
      const response = await fetch(url, {
        headers: {
          Cookie: cookieHeader,
          "X-Request-Id": requestId,
        },
      });
      assert(response.ok, `${requestId} failed with ${response.status}`);
    }
  }

  printStep("Waiting for Prometheus scrapes and log shipping");
  await sleep(options.waitMs);

  printStep("Verifying Prometheus, backend log file, Loki, Tempo, and Grafana");
  await verifyPrometheusTargets(options);
  verifyBackendLogFile(
    options,
    [
      "monitoring-login-fail-1",
      "monitoring-products-1",
      ...(options.skipFrontend ? [] : ["monitoring-fe-products-1"]),
    ],
  );

  const loginFailLog = await queryLoki(options.lokiUrl, "monitoring-login-fail-1");
  const productsLog = await queryLoki(options.lokiUrl, "monitoring-products-1");
  await verifyTempoTrace(options.tempoUrl, productsLog.traceId, "monitoring-products-1");

  let frontendProductsLog = null;
  if (!options.skipFrontend) {
    frontendProductsLog = await queryLoki(options.lokiUrl, "monitoring-fe-products-1");
    await verifyTempoTrace(options.tempoUrl, frontendProductsLog.traceId, "monitoring-fe-products-1");
  }

  await verifyGrafanaDashboard(options);

  printResult("Prometheus targets backend, otel-collector, and postgres-exporter are UP");
  printResult("backend.ndjson contains the smoke request ids");
  printResult(`Loki log found for monitoring-login-fail-1 with status ${loginFailLog.statusCode}`);
  printResult(`Loki log found for monitoring-products-1 with route ${productsLog.route}`);
  if (frontendProductsLog) {
    printResult(`Loki log found for monitoring-fe-products-1 with route ${frontendProductsLog.route}`);
  }
  printResult(`Tempo trace verified for monitoring-products-1: ${productsLog.traceId}`);
  if (frontendProductsLog) {
    printResult(`Tempo trace verified for monitoring-fe-products-1: ${frontendProductsLog.traceId}`);
  }
  printResult("Grafana dashboard Ledger Light QA Observability is present");

  console.log("\nQA monitoring smoke test passed");
}

main().catch((error) => {
  console.error(`\nQA monitoring smoke test failed: ${error.message}`);
  process.exit(1);
});
