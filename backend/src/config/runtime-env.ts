import fs from 'node:fs';
import path from 'node:path';

const SUPPORTED_ENVIRONMENTS = ['dev', 'qa', 'prod'] as const;

export type LedgerLightEnvironment = (typeof SUPPORTED_ENVIRONMENTS)[number];

export function resolveLedgerLightEnvironment(
  explicitEnvironment?: string,
): LedgerLightEnvironment {
  const candidate = explicitEnvironment ?? process.env.LEDGERLIGHT_ENV;

  if (candidate) {
    if (SUPPORTED_ENVIRONMENTS.includes(candidate as LedgerLightEnvironment)) {
      return candidate as LedgerLightEnvironment;
    }

    throw new Error(
      `Unsupported LEDGERLIGHT_ENV "${candidate}". Expected one of dev, qa, prod.`,
    );
  }

  if (process.env.NODE_ENV === 'production') {
    return 'prod';
  }

  return 'dev';
}

export function resolveBackendEnvFilePaths(options?: {
  environment?: string;
  cwd?: string;
}) {
  const environment = resolveLedgerLightEnvironment(options?.environment);
  const cwd = path.resolve(options?.cwd ?? process.cwd());
  const searchRoots = Array.from(new Set([cwd, path.resolve(cwd, '..')]));
  const candidateNames = [`.env.${environment}`, '.env'];

  return searchRoots
    .flatMap((root) =>
      candidateNames.map((fileName) => path.join(root, fileName)),
    )
    .filter((filePath, index, allPaths) => {
      return allPaths.indexOf(filePath) === index && fs.existsSync(filePath);
    });
}
