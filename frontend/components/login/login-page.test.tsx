import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/components/login/login-page";

const replace = vi.fn();
const getSearchParam = vi.fn();
const getCookie = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: getSearchParam }),
}));

vi.mock("@/hooks/use-cookies", () => ({
  useCookies: () => ({ getCookie }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    replace.mockReset();
    getSearchParam.mockReset();
    getCookie.mockReset();
    getSearchParam.mockReturnValue(null);
    getCookie.mockReturnValue(undefined);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("validates required login fields", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
  });

  it("submits credentials and redirects to returnTo when login succeeds", async () => {
    const user = userEvent.setup();
    getSearchParam.mockReturnValue("/orders");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<LoginPage />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/auth/login", expect.any(Object));
      expect(replace).toHaveBeenCalledWith("/orders");
    });
  });
});
