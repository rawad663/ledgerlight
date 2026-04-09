import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  loadRootEnvironment,
  resolveLedgerLightEnvironment,
} from "./root-env.mjs";

const originalEnvironment = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnvironment)) {
    process.env[key] = value;
  }
});

describe("resolveLedgerLightEnvironment", () => {
  it("defaults to dev outside production", () => {
    delete process.env.LEDGERLIGHT_ENV;
    process.env.NODE_ENV = "development";

    expect(resolveLedgerLightEnvironment()).toBe("dev");
  });

  it("defaults to prod in production mode", () => {
    delete process.env.LEDGERLIGHT_ENV;
    process.env.NODE_ENV = "production";

    expect(resolveLedgerLightEnvironment()).toBe("prod");
  });

  it("prefers LEDGERLIGHT_ENV when provided", () => {
    process.env.LEDGERLIGHT_ENV = "qa";
    process.env.NODE_ENV = "development";

    expect(resolveLedgerLightEnvironment()).toBe("qa");
  });
});

describe("loadRootEnvironment", () => {
  it("loads values from the selected root env file", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ledgerlight-env-"));
    fs.writeFileSync(
      path.join(repoRoot, ".env.qa"),
      [
        "# comment",
        "NEXT_PUBLIC_API_URL=http://localhost:8081",
        "JWT_ACCESS_SECRET=qa-secret",
      ].join("\n"),
    );

    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.JWT_ACCESS_SECRET;

    const result = loadRootEnvironment({ environment: "qa", repoRoot });

    expect(result.environment).toBe("qa");
    expect(result.values.NEXT_PUBLIC_API_URL).toBe("http://localhost:8081");
    expect(process.env.NEXT_PUBLIC_API_URL).toBe("http://localhost:8081");
    expect(process.env.JWT_ACCESS_SECRET).toBe("qa-secret");
  });

  it("falls back to the committed example file when the local env file is missing", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ledgerlight-env-"));
    fs.writeFileSync(
      path.join(repoRoot, ".env.prod.example"),
      "NEXT_PUBLIC_API_URL=https://prod.example\n",
    );

    delete process.env.NEXT_PUBLIC_API_URL;

    const result = loadRootEnvironment({ environment: "prod", repoRoot });

    expect(result.envFilePath).toBe(path.join(repoRoot, ".env.prod.example"));
    expect(process.env.NEXT_PUBLIC_API_URL).toBe("https://prod.example");
  });

  it("does not override already exported variables", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ledgerlight-env-"));
    fs.writeFileSync(
      path.join(repoRoot, ".env.dev"),
      "NEXT_PUBLIC_API_URL=http://localhost:8080\n",
    );

    process.env.NEXT_PUBLIC_API_URL = "http://override.example";

    loadRootEnvironment({ environment: "dev", repoRoot });

    expect(process.env.NEXT_PUBLIC_API_URL).toBe("http://override.example");
  });

  it("throws when neither the local env file nor the example file exists", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ledgerlight-env-"));

    expect(() =>
      loadRootEnvironment({ environment: "dev", repoRoot }),
    ).toThrowError(
      `Missing environment file: ${path.join(repoRoot, ".env.dev")} or ${path.join(repoRoot, ".env.dev.example")}.`,
    );
  });
});
