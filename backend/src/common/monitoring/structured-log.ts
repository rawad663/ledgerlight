import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type StructuredLogLevel = 'info' | 'warn' | 'error';

type StructuredLogPayload = {
  message: string;
} & Record<string, unknown>;

export function writeStructuredLog(
  level: StructuredLogLevel,
  context: string,
  payload: StructuredLogPayload,
) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    ...payload,
  };
  const line = JSON.stringify(entry);

  // these logs are meant to go to stdout as structured JSON and also into a file for Loki ingestion
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  const logFilePath = process.env.LOG_FILE_PATH;
  if (!logFilePath) {
    return;
  }

  try {
    mkdirSync(dirname(logFilePath), { recursive: true });
    appendFileSync(logFilePath, `${line}\n`, 'utf8');
  } catch {
    // Logging should never take the request path down in local observability mode.
  }
}
