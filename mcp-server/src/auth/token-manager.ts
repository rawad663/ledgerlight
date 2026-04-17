import axios from "axios";
import { decodeJwt } from "jose";
import type { Config } from "../config";
import { getLogger } from "../logger/logger";

interface TokenState {
  accessToken: string;
  accessTokenExpSec: number;
  refreshToken: string;
  userId: string;
}

interface LoginResponse {
  accessToken: string;
  refreshTokenRaw: string;
  user: { id: string };
}

interface RefreshResponse {
  accessToken: string;
}

export class TokenManager {
  private state: TokenState | null = null;
  private static readonly BUFFER_SEC = 60;

  constructor(private readonly config: Config) {}

  async getAccessToken(): Promise<string> {
    const nowSec = Math.floor(Date.now() / 1000);

    // Tier 1: cached access token still valid
    if (
      this.state &&
      this.state.accessTokenExpSec > nowSec + TokenManager.BUFFER_SEC
    ) {
      return this.state.accessToken;
    }

    // Tier 2: have refresh token — try silent re-issue
    if (this.state?.refreshToken) {
      try {
        const res = await axios.post<RefreshResponse>(
          `${this.config.BACKEND_URL}/auth/refresh`,
          {
            refreshTokenRaw: this.state.refreshToken,
            userId: this.state.userId,
          },
        );
        const accessToken = res.data.accessToken;
        const claims = decodeJwt(accessToken);
        this.state = {
          ...this.state,
          accessToken,
          accessTokenExpSec:
            typeof claims.exp === "number" ? claims.exp : nowSec + 900,
        };
        getLogger().debug(
          { event: "token_refreshed" },
          "Access token refreshed via refresh token",
        );
        return this.state.accessToken;
      } catch {
        // Refresh token expired or revoked — fall through to full login
        this.state = null;
        getLogger().warn(
          { event: "refresh_token_expired" },
          "Refresh token expired or revoked, falling back to credential login",
        );
      }
    }

    // Tier 3: full credential login
    const res = await axios.post<LoginResponse>(
      `${this.config.BACKEND_URL}/auth/login`,
      {
        email: this.config.MCP_SERVICE_EMAIL,
        password: this.config.MCP_SERVICE_PASSWORD,
      },
    );

    const { accessToken, refreshTokenRaw, user } = res.data;
    const claims = decodeJwt(accessToken);
    this.state = {
      accessToken,
      accessTokenExpSec:
        typeof claims.exp === "number" ? claims.exp : nowSec + 900,
      refreshToken: refreshTokenRaw,
      userId: user.id,
    };
    getLogger().info(
      { event: "login_success", userId: user.id },
      "MCP service account logged in",
    );
    return this.state.accessToken;
  }
}
