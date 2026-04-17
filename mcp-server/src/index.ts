import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config";
import { TokenManager } from "./auth/token-manager";
import { createMcpServer } from "./server";
import { getLogger } from "./logger/logger";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = getLogger(config);

  const tokenManager = new TokenManager(config);
  const server = createMcpServer(config, tokenManager);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info("LedgerLight MCP server connected via stdio");
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "startup_failure",
      error: String(err),
    }),
  );
  process.exit(1);
});
