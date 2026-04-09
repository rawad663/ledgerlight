import { expect,test } from "../fixtures";

test.describe("frontend invite integration", () => {
  test("renders expired and invalid invite states", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");

    await page.goto(`/invite/${scenario.current().invitationTokens.expired}`);
    await expect(page.getByText("This invite has expired")).toBeVisible();

    await page.goto(`/invite/${scenario.current().invitationTokens.invalid}`);
    await expect(page.getByText("This invite link is invalid")).toBeVisible();
  });

  test("accepts new-user invites and authenticated existing-user invites", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");

    await page.goto(`/invite/${scenario.current().invitationTokens.newUser}`);
    await page.getByPlaceholder("Minimum 8 characters").fill("supersecret");
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page.getByText("Invite accepted")).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue to login" })).toBeVisible();

    await scenario.load("full-app");
    await scenario.setSession(page, "existingInviteUser");
    await page.goto(`/invite/${scenario.current().invitationTokens.existingUser}`);
    await page.getByRole("button", { name: "Accept invitation" }).click();

    await expect(page.getByText("Invite accepted")).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue to app" })).toBeVisible();
  });
});
