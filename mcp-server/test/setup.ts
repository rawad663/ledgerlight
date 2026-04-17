// Inject required env vars for all tests.
// These must be set before any module is imported, so they're set here in
// setupFiles (runs before the test framework is installed).
process.env.BACKEND_URL = "http://localhost:8080";
process.env.MCP_SERVICE_EMAIL = "mcp-service@test.com";
process.env.MCP_SERVICE_PASSWORD = "test-password-123";
process.env.MCP_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001";
process.env.LOG_LEVEL = "silent";
process.env.LOG_PRETTY = "false";

// Suppress pino output entirely in tests by sending logs to /dev/null
process.env.PINO_DEST = "/dev/null";
