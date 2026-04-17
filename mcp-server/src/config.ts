import { z } from "zod";

const ConfigSchema = z.object({
  BACKEND_URL: z.string().url(),
  MCP_SERVICE_EMAIL: z.string().email(),
  MCP_SERVICE_PASSWORD: z.string().min(8),
  MCP_ORGANIZATION_ID: z.string().uuid(),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "silent"])
    .default("info"),
  LOG_PRETTY: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(", ");
    throw new Error(`Invalid MCP server configuration: ${issues}`);
  }
  return result.data;
}
