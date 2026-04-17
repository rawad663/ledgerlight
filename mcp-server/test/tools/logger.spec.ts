type PinoFactory = jest.Mock & {
  destination: jest.Mock;
};

const BASE_CONFIG = {
  BACKEND_URL: "http://localhost:8080",
  MCP_SERVICE_EMAIL: "mcp-service@test.com",
  MCP_SERVICE_PASSWORD: "test-password-123",
  MCP_ORGANIZATION_ID: "00000000-0000-0000-0000-000000000001",
  LOG_LEVEL: "info" as const,
  LOG_PRETTY: false,
};

describe("getLogger", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("writes structured logs to stderr when pretty logging is disabled", async () => {
    const destination = { write: jest.fn() };
    const loggerInstance = { info: jest.fn(), warn: jest.fn() };
    const pino = Object.assign(
      jest.fn(() => loggerInstance),
      {
        destination: jest.fn(() => destination),
      },
    ) as PinoFactory;

    jest.doMock("pino", () => ({
      __esModule: true,
      default: pino,
    }));

    await jest.isolateModulesAsync(async () => {
      const { getLogger } = await import("../../src/logger/logger");

      const logger = getLogger(BASE_CONFIG);

      expect(logger).toBe(loggerInstance);
      expect(pino.destination).toHaveBeenCalledWith(2);
      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          base: { service: "ledgerlight-mcp" },
        }),
        destination,
      );
    });
  });

  it("routes pretty logs to stderr when pretty logging is enabled", async () => {
    const loggerInstance = { info: jest.fn(), warn: jest.fn() };
    const pino = Object.assign(
      jest.fn(() => loggerInstance),
      {
        destination: jest.fn(),
      },
    ) as PinoFactory;

    jest.doMock("pino", () => ({
      __esModule: true,
      default: pino,
    }));

    await jest.isolateModulesAsync(async () => {
      const { getLogger } = await import("../../src/logger/logger");

      const logger = getLogger({ ...BASE_CONFIG, LOG_PRETTY: true });

      expect(logger).toBe(loggerInstance);
      expect(pino.destination).not.toHaveBeenCalled();
      expect(pino).toHaveBeenCalledWith(
        expect.objectContaining({
          transport: {
            target: "pino-pretty",
            options: { colorize: true, destination: 2 },
          },
        }),
      );
    });
  });
});
