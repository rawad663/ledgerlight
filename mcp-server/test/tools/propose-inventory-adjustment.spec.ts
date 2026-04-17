import * as clientModule from "../../src/client/ledgerlight-client";
import * as tokenContextModule from "../../src/auth/token-context";
import { loadConfig } from "../../src/config";
import { TokenManager } from "../../src/auth/token-manager";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProposeInventoryAdjustment } from "../../src/tools/propose-inventory-adjustment";
import {
  createAxiosMock,
  makeAxiosResponse,
  makeAxiosError,
} from "../mocks/axios.mock";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";

jest.mock("../../src/client/ledgerlight-client");
jest.mock("../../src/auth/token-context");

const FAKE_ACCESS_TOKEN = "fake-access-token";
const FAKE_CORRELATION_ID = "11111111-1111-1111-1111-111111111111";

const FAKE_CONTEXT = {
  organizationId: "00000000-0000-0000-0000-000000000001",
  accessToken: FAKE_ACCESS_TOKEN,
  correlationId: FAKE_CORRELATION_ID,
};

const ADJUSTMENT_RESPONSE = {
  inventoryLevel: { id: "lvl-1", quantity: 8 },
  adjustment: { id: "adj-1", delta: 5, reason: "RESTOCK" },
};

type RegisteredTools = Record<
  string,
  { handler: (args: Record<string, unknown>) => Promise<unknown> }
>;

function getHandler(server: McpServer, toolName: string) {
  const tools = (server as any)._registeredTools as RegisteredTools;
  return tools[toolName].handler;
}

describe("propose_inventory_adjustment", () => {
  let config: ReturnType<typeof loadConfig>;
  let tokenManager: TokenManager;
  let axiosMock: ReturnType<typeof createAxiosMock>;

  beforeEach(() => {
    config = loadConfig();
    tokenManager = new TokenManager(config);

    axiosMock = createAxiosMock();
    (clientModule.getLedgerlightClient as jest.Mock).mockReturnValue(axiosMock);
    (tokenContextModule.buildToolContext as jest.Mock).mockResolvedValue(
      FAKE_CONTEXT,
    );
  });

  function buildServer() {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    registerProposeInventoryAdjustment(server, config, tokenManager);
    return server;
  }

  it("POSTs to /inventory/adjustments with AI/MCP note prefix", async () => {
    axiosMock.post.mockResolvedValue(makeAxiosResponse(ADJUSTMENT_RESPONSE));

    const handler = getHandler(buildServer(), "propose_inventory_adjustment");

    await handler({
      productId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      locationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      delta: 5,
      reason: "RESTOCK",
      note: "restocking warehouse",
    });

    expect(axiosMock.post).toHaveBeenCalledWith(
      "/inventory/adjustments",
      expect.objectContaining({
        delta: 5,
        reason: "RESTOCK",
        note: expect.stringMatching(/^\[AI\/MCP correlationId:/),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${FAKE_ACCESS_TOKEN}`,
          "X-Organization-Id": "00000000-0000-0000-0000-000000000001",
          "X-Request-Id": FAKE_CORRELATION_ID,
        }),
      }),
    );
  });

  it("includes the user note after the AI prefix", async () => {
    axiosMock.post.mockResolvedValue(makeAxiosResponse(ADJUSTMENT_RESPONSE));

    const handler = getHandler(buildServer(), "propose_inventory_adjustment");

    await handler({
      productId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      locationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      delta: -3,
      reason: "SHRINKAGE",
      note: "lost three units",
    });

    const payload = axiosMock.post.mock.calls[0][1] as { note: string };
    expect(payload.note).toMatch(/lost three units/);
    expect(payload.note).toMatch(/^\[AI\/MCP correlationId:/);
  });

  it("works without an optional note — prefix only", async () => {
    axiosMock.post.mockResolvedValue(makeAxiosResponse(ADJUSTMENT_RESPONSE));

    const handler = getHandler(buildServer(), "propose_inventory_adjustment");

    await handler({
      productId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      locationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      delta: 10,
      reason: "RESTOCK",
    });

    const payload = axiosMock.post.mock.calls[0][1] as { note: string };
    expect(payload.note).toMatch(/^\[AI\/MCP correlationId:[^\]]+\]$/);
  });

  it("throws McpError with InvalidParams on 400 from backend", async () => {
    axiosMock.post.mockRejectedValue(
      makeAxiosError(400, "productId must be a UUID"),
    );

    const handler = getHandler(buildServer(), "propose_inventory_adjustment");

    await expect(
      handler({
        productId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        locationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        delta: 5,
        reason: "RESTOCK",
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
  });

  it("throws McpError with InvalidRequest on 403 from backend", async () => {
    axiosMock.post.mockRejectedValue(
      makeAxiosError(403, "Insufficient permissions"),
    );

    const handler = getHandler(buildServer(), "propose_inventory_adjustment");

    await expect(
      handler({
        productId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        locationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        delta: 5,
        reason: "RESTOCK",
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidRequest });
  });
});
