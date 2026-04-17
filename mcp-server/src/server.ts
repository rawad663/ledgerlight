import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "./config";
import type { TokenManager } from "./auth/token-manager";
import {
  registerSearchOrders,
  registerGetOrderDetails,
  registerGetOrdersForCustomer,
  registerCheckInventory,
  registerSearchProducts,
  registerProposeInventoryAdjustment,
  registerListLowStockProducts,
} from "./tools";

export function createMcpServer(
  config: Config,
  tokenManager: TokenManager,
): McpServer {
  const server = new McpServer({
    name: "ledgerlight-mcp",
    version: "0.1.0",
  });

  registerSearchOrders(server, config, tokenManager);
  registerGetOrderDetails(server, config, tokenManager);
  registerGetOrdersForCustomer(server, config, tokenManager);
  registerCheckInventory(server, config, tokenManager);
  registerSearchProducts(server, config, tokenManager);
  registerProposeInventoryAdjustment(server, config, tokenManager);
  registerListLowStockProducts(server, config, tokenManager);

  return server;
}
