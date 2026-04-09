import fs from "node:fs";
import path from "node:path";

const SUPPORTED_ENVIRONMENTS = new Set(["dev", "qa", "prod"]);

export function resolveLedgerLightEnvironment(explicitEnvironment) {
  if (explicitEnvironment) {
    return explicitEnvironment;
  }

  if (process.env.LEDGERLIGHT_ENV) {
    return process.env.LEDGERLIGHT_ENV;
  }

  if (process.env.NODE_ENV === "production") {
    return "prod";
  }

  return "dev";
}

function parseEnvFile(contents) {
  const entries = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

export function loadRootEnvironment(options = {}) {
  const environment = resolveLedgerLightEnvironment(options.environment);

  if (!SUPPORTED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      `Unsupported LEDGERLIGHT_ENV "${environment}". Expected one of dev, qa, prod.`,
    );
  }

  const repoRoot = path.resolve(
    options.repoRoot ?? path.join(process.cwd(), ".."),
  );
  const envFilePath = path.join(repoRoot, `.env.${environment}`);
  const fallbackEnvFilePath = path.join(repoRoot, `.env.${environment}.example`);
  const resolvedEnvFilePath = fs.existsSync(envFilePath)
    ? envFilePath
    : fallbackEnvFilePath;

  if (!fs.existsSync(resolvedEnvFilePath)) {
    throw new Error(
      `Missing environment file: ${envFilePath} or ${fallbackEnvFilePath}.`,
    );
  }

  const parsedValues = parseEnvFile(
    fs.readFileSync(resolvedEnvFilePath, "utf8"),
  );

  for (const [key, value] of Object.entries(parsedValues)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  return {
    environment,
    envFilePath: resolvedEnvFilePath,
    values: parsedValues,
  };
}
