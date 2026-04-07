import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InviteAcceptancePage } from "@/components/team/invite-acceptance-page";

const { authenticatedApiClient, publicApiClient } = vi.hoisted(() => ({
  authenticatedApiClient: {
    POST: vi.fn(),
  },
  publicApiClient: {
    POST: vi.fn(),
  },
}));

vi.mock("@/hooks/use-api", () => ({
  useApiClient: vi.fn((withAuthHeaders: boolean = true) =>
    withAuthHeaders ? authenticatedApiClient : publicApiClient,
  ),
}));

vi.mock("@/hooks/use-user", () => ({
  useUser: vi.fn(),
}));

import { User, useUser } from "@/hooks/use-user";

describe("InviteAcceptancePage", () => {
  beforeEach(() => {
    authenticatedApiClient.POST.mockReset();
    publicApiClient.POST.mockReset();
    vi.mocked(useUser).mockReturnValue(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders expired invites with a recovery message", async () => {
    publicApiClient.POST.mockResolvedValueOnce({
      data: {
        status: "EXPIRED",
      },
      error: undefined,
      response: { status: 200 },
    });

    render(<InviteAcceptancePage token="expired-token" />);

    expect(
      await screen.findByText("This invite has expired"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/resend a fresh invitation link/i),
    ).toBeInTheDocument();
  });

  it("accepts a new-user invite after setting a password", async () => {
    const user = userEvent.setup();
    publicApiClient.POST.mockResolvedValueOnce({
      data: {
        status: "VALID",
        organizationName: "Ledger Light",
        roleDescription: "Manager access across operations.",
        requiresPassword: true,
        member: {
          membershipId: "mem-1",
          userId: "user-1",
          displayName: "Casey Rivera",
          email: "casey@example.com",
          role: "MANAGER",
          status: "INVITED",
          hasAllLocations: true,
          locations: [],
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:00.000Z",
          inviteExpired: false,
        },
      },
      error: undefined,
      response: { status: 200 },
    });
    authenticatedApiClient.POST.mockResolvedValueOnce({
      data: {
        message: "Invite accepted",
        member: {
          membershipId: "mem-1",
          userId: "user-1",
          displayName: "Casey Rivera",
          email: "casey@example.com",
          role: "MANAGER",
          status: "ACTIVE",
          hasAllLocations: true,
          locations: [],
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:05:00.000Z",
          inviteExpired: false,
          permissions: [],
          activity: [],
        },
      },
      error: undefined,
      response: { status: 200 },
    });

    render(<InviteAcceptancePage token="valid-token" />);

    expect(await screen.findByText("Join Ledger Light")).toBeInTheDocument();
    const passwordInput = screen.getByPlaceholderText("Minimum 8 characters");
    await user.type(passwordInput, "supersecret");
    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => {
      expect(authenticatedApiClient.POST).toHaveBeenCalledWith(
        "/team/invitations/accept",
        expect.objectContaining({
          body: {
            token: "valid-token",
            password: "supersecret",
          },
        }),
      );
    });

    expect(await screen.findByText("Invite accepted")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continue to login" }),
    ).toHaveAttribute("href", "/login");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("prompts existing-account invitees to log in before accepting", async () => {
    publicApiClient.POST.mockResolvedValueOnce({
      data: {
        status: "VALID",
        organizationName: "Ledger Light",
        roleDescription: "Manager access across operations.",
        requiresPassword: false,
        member: {
          membershipId: "mem-1",
          userId: "user-1",
          displayName: "Casey Rivera",
          email: "casey@example.com",
          role: "MANAGER",
          status: "INVITED",
          hasAllLocations: true,
          locations: [],
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:00.000Z",
          inviteExpired: false,
        },
      },
      error: undefined,
      response: { status: 200 },
    });

    render(<InviteAcceptancePage token="valid-token" />);

    expect(
      await screen.findByRole("link", { name: "Log in to accept" }),
    ).toHaveAttribute("href", "/login?returnTo=%2Finvite%2Fvalid-token");
    expect(
      screen.queryByRole("button", { name: "Accept invitation" }),
    ).not.toBeInTheDocument();
  });

  it("refreshes the session after an authenticated user accepts an invite", async () => {
    const user = userEvent.setup();
    vi.mocked(useUser).mockReturnValue({
      user: { id: "user-1" },
    } as unknown as User);
    publicApiClient.POST.mockResolvedValueOnce({
      data: {
        status: "VALID",
        organizationName: "Ledger Light",
        roleDescription: "Manager access across operations.",
        requiresPassword: false,
        member: {
          membershipId: "mem-1",
          userId: "user-1",
          displayName: "Casey Rivera",
          email: "casey@example.com",
          role: "MANAGER",
          status: "INVITED",
          hasAllLocations: true,
          locations: [],
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:00.000Z",
          inviteExpired: false,
        },
      },
      error: undefined,
      response: { status: 200 },
    });
    authenticatedApiClient.POST.mockResolvedValueOnce({
      data: {
        message: "Invite accepted",
        member: {
          membershipId: "mem-1",
          userId: "user-1",
          displayName: "Casey Rivera",
          email: "casey@example.com",
          role: "MANAGER",
          status: "ACTIVE",
          hasAllLocations: true,
          locations: [],
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:05:00.000Z",
          inviteExpired: false,
          permissions: [],
          activity: [],
        },
      },
      error: undefined,
      response: { status: 200 },
    });
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: "fresh-access-token" }),
    } as Response);

    render(<InviteAcceptancePage token="existing-user-token" />);

    expect(await screen.findByText("Join Ledger Light")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/auth/refresh", {
        method: "POST",
      });
    });

    expect(
      await screen.findByRole("link", { name: "Continue to app" }),
    ).toHaveAttribute("href", "/");
  });
});
