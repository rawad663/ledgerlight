import axios from "axios";
import { TokenManager } from "../../src/auth/token-manager";
import { loadConfig } from "../../src/config";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// A non-expired JWT payload: exp = year 2100
const FAKE_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  Buffer.from(JSON.stringify({ sub: "user-1", exp: 4102444800 })).toString(
    "base64url",
  ) +
  ".fake-sig";

const FAKE_REFRESH_TOKEN = "refresh-abc123";
const FAKE_USER_ID = "00000000-0000-0000-0000-000000000002";

const LOGIN_RESPONSE = {
  accessToken: FAKE_ACCESS_TOKEN,
  refreshToken: { token: FAKE_REFRESH_TOKEN },
  user: { id: FAKE_USER_ID },
};

const REFRESH_RESPONSE = {
  accessToken: FAKE_ACCESS_TOKEN,
};

describe("TokenManager", () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    const config = loadConfig();
    tokenManager = new TokenManager(config);
  });

  describe("Tier 3 — credential login (first run, no state)", () => {
    it("calls POST /auth/login and returns the access token", async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: LOGIN_RESPONSE });

      const token = await tokenManager.getAccessToken();

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "http://localhost:8080/auth/login",
        {
          email: "mcp-service@test.com",
          password: "test-password-123",
        },
      );
      expect(token).toBe(FAKE_ACCESS_TOKEN);
    });

    it("propagates login failure with the original error", async () => {
      const loginError = new Error("Invalid credentials");
      mockedAxios.post.mockRejectedValueOnce(loginError);

      await expect(tokenManager.getAccessToken()).rejects.toThrow(
        "Invalid credentials",
      );
    });
  });

  describe("Tier 1 — access token cache hit", () => {
    it("returns cached token without any network call on second invocation", async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: LOGIN_RESPONSE });

      const token1 = await tokenManager.getAccessToken();
      const token2 = await tokenManager.getAccessToken();

      // Only one call (the initial login) — no refresh on second call
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(token1).toBe(token2);
    });
  });

  describe("Tier 2 — refresh token", () => {
    it("calls POST /auth/refresh when access token is stale but refresh token is present", async () => {
      // Prime the state via login
      mockedAxios.post.mockResolvedValueOnce({ data: LOGIN_RESPONSE });
      await tokenManager.getAccessToken();

      // Force access token to be "expired" by manipulating private state

      (tokenManager as any).state.accessTokenExpSec = 0;

      mockedAxios.post.mockResolvedValueOnce({ data: REFRESH_RESPONSE });
      const token = await tokenManager.getAccessToken();

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        "http://localhost:8080/auth/refresh",
        { refreshTokenRaw: FAKE_REFRESH_TOKEN, userId: FAKE_USER_ID },
      );
      expect(token).toBe(FAKE_ACCESS_TOKEN);
    });
  });

  describe("Tier 2 → Tier 3 fallback", () => {
    it("falls back to login when refresh returns 401", async () => {
      // Prime with login
      mockedAxios.post.mockResolvedValueOnce({ data: LOGIN_RESPONSE });
      await tokenManager.getAccessToken();

      // Force stale access token

      (tokenManager as any).state.accessTokenExpSec = 0;

      // Refresh fails
      const refreshError = new Error("Refresh token expired");
      mockedAxios.post.mockRejectedValueOnce(refreshError);

      // Login succeeds
      mockedAxios.post.mockResolvedValueOnce({ data: LOGIN_RESPONSE });

      const token = await tokenManager.getAccessToken();

      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // login + failed refresh + new login
      expect(token).toBe(FAKE_ACCESS_TOKEN);
    });
  });
});
