import { expect,test } from "../fixtures";
import { chooseSelectOption } from "../helpers";

test.describe("frontend team integration", () => {
  test("supports member invite and team management mutations", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "owner");

    await page.goto("/team");
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();
    await expect(page.getByText("Pending invites")).toBeVisible();

    await page.getByRole("button", { name: "Invite member" }).click();
    await page.getByLabel("Email").fill("teammate@example.com");
    await chooseSelectOption(
      page,
      page.getByRole("dialog", { name: "Invite member" }).getByRole("combobox", { name: "Role" }),
      "Support",
    );
    await page.getByRole("button", { name: "Send invite" }).click();

    await expect(page.locator("tr", { hasText: "teammate@example.com" })).toBeVisible();

    const pendingBeforeResend = (await scenario.inspect()).teamMembers.find(
      (member) => member.email === "pending@example.com",
    );

    expect(pendingBeforeResend).toBeDefined();
    await page.locator("tr", { hasText: "Pat Pending" }).click();
    await page.getByRole("button", { name: "Resend invite" }).click();
    await expect
      .poll(async () => {
        const pendingAfterResend = (await scenario.inspect()).teamMembers.find(
          (member) => member.email === "pending@example.com",
        );

        return pendingAfterResend?.updatedAt;
      })
      .not.toBe(pendingBeforeResend?.updatedAt);
    await page.getByRole("dialog", { name: "Pat Pending" }).getByRole("button", { name: "Close" }).first().click();

    await page.locator("tr", { hasText: "Manny Manager" }).click();
    await expect(page.getByRole("button", { name: "Change role" })).toBeVisible();

    await chooseSelectOption(
      page,
      page.getByRole("combobox").last(),
      "Support",
    );
    await page.getByRole("button", { name: "Change role" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect
      .poll(async () => {
        const manager = (await scenario.inspect()).teamMembers.find(
          (member) => member.email === "manager@example.com",
        );

        return manager?.role;
      })
      .toBe("SUPPORT");

    await page.getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("button", { name: "Deactivate" }).last().click();
    await expect
      .poll(async () => {
        const manager = (await scenario.inspect()).teamMembers.find(
          (member) => member.email === "manager@example.com",
        );

        return manager?.status;
      })
      .toBe("DEACTIVATED");
  });

  test("renders the access warning for non-managerial roles", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "cashier");

    await page.goto("/team");

    await expect(
      page.getByText("You don't have access to Team management."),
    ).toBeVisible();
  });

  test("reactivates a deactivated member from the list", async ({
    page,
    scenario,
  }) => {
    await scenario.load("team-reactivate");
    await scenario.setSession(page, "owner");

    await page.goto("/team");
    await chooseSelectOption(
      page,
      page.getByRole("combobox").filter({ hasText: "Active + invited" }),
      "Deactivated",
    );

    await page.locator("tr", { hasText: "Manny Manager" }).click();
    await page.getByRole("button", { name: "Reactivate" }).click();

    await expect
      .poll(async () => {
        const manager = (await scenario.inspect()).teamMembers.find(
          (member) => member.email === "manager@example.com",
        );

        return manager?.status;
      })
      .toBe("ACTIVE");
  });
});
