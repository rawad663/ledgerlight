import { expect, test } from "../fixtures";
import { loginThroughUi, openUserMenu } from "../helpers";

test.use({
  trace: "on",
  video: "on",
});

test.describe("frontend auth integration", () => {
  test("logs in through the real login page, navigates to returnTo, and signs out", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");

    await loginThroughUi(page, "owner@example.com", "password123", "/orders");

    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/login(\?returnTo=%2Forders)?$/);
  });

  test("shows an inline error when login fails", async ({ page, scenario }) => {
    await scenario.load("full-app");

    await loginThroughUi(page, "owner@example.com", "wrong-password");

    await expect(
      page.getByText(/Login failed|Invalid email or password/),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("refreshes an expired session on private-route access", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    const expiredToken = scenario.current().sessions.ownerExpired.accessToken;

    await scenario.setSession(page, "ownerExpired");
    await page.goto("/orders");

    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

    const cookies = await page.context().cookies();
    const accessToken = cookies.find(
      (cookie) => cookie.name === "access_token",
    );

    expect(accessToken?.value).not.toBe(expiredToken);
  });

  test("redirects back to login when refresh fails", async ({
    page,
    scenario,
  }) => {
    await scenario.load("auth-refresh-fail");
    await scenario.setSession(page, "ownerExpired");

    await page.goto("/orders");

    await expect(page).toHaveURL(/\/login\?returnTo=%2Forders$/);
    await expect(page.getByText("Login to Ledger Light")).toBeVisible();
  });
});
