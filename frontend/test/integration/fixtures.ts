import { expect, type Page,test as base } from "@playwright/test";

type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  organizationId: string;
};

type ScenarioPayload = {
  scenario: string;
  sessions: Record<string, SessionPayload>;
  teamMembers: Array<{
    membershipId: string;
    displayName: string;
    email: string;
    inviteExpired: boolean;
    role: string;
    updatedAt: string;
    status: string;
  }>;
  invitationTokens: {
    expired: string;
    newUser: string;
    existingUser: string;
    invalid: string;
  };
};

type ScenarioController = {
  load: (name?: string) => Promise<ScenarioPayload>;
  current: () => ScenarioPayload;
  inspect: () => Promise<ScenarioPayload>;
  setSession: (
    page: Page,
    sessionName: keyof ScenarioPayload["sessions"],
    overrides?: Partial<SessionPayload>,
  ) => Promise<void>;
  clearSession: (page: Page) => Promise<void>;
};

const mockApiBaseUrl =
  process.env.MOCK_API_BASE_URL ?? "http://127.0.0.1:4011";
const frontendBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3005";
const frontendHost = new URL(frontendBaseUrl).hostname;

async function fetchScenario(name = "full-app"): Promise<ScenarioPayload> {
  const response = await fetch(`${mockApiBaseUrl}/__scenario/reset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reset scenario ${name}`);
  }

  return response.json();
}

async function fetchCurrentScenario(): Promise<ScenarioPayload> {
  const response = await fetch(`${mockApiBaseUrl}/__scenario/current`);

  if (!response.ok) {
    throw new Error("Failed to inspect current scenario state");
  }

  return response.json();
}

export const test = base.extend<{ scenario: ScenarioController }>({
  scenario: async ({ browserName: _browserName }, applyFixture) => {
    let payload = await fetchScenario("full-app");

    await applyFixture({
      async load(name = "full-app") {
        payload = await fetchScenario(name);
        return payload;
      },
      current() {
        return payload;
      },
      async inspect() {
        payload = await fetchCurrentScenario();
        return payload;
      },
      async setSession(page, sessionName, overrides = {}) {
        const session = {
          ...payload.sessions[sessionName],
          ...overrides,
        };

        await page.context().addCookies([
          {
            name: "access_token",
            value: session.accessToken,
            domain: frontendHost,
            path: "/",
            httpOnly: false,
            sameSite: "Lax",
          },
          {
            name: "refresh_token",
            value: session.refreshToken,
            domain: frontendHost,
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
          {
            name: "user_id",
            value: session.userId,
            domain: frontendHost,
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
          {
            name: "x_organization_id",
            value: session.organizationId,
            domain: frontendHost,
            path: "/",
            httpOnly: false,
            sameSite: "Lax",
          },
        ]);
      },
      async clearSession(page) {
        await page.context().clearCookies();
      },
    });
  },
});

export { expect };
