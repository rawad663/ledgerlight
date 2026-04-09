import { expect,test } from "../fixtures";
import { chooseSelectOption, openRowActions } from "../helpers";

test.describe("frontend locations integration", () => {
  test("renders counts, creates a location, edits it, and shows delete conflicts", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "owner");

    await page.goto("/locations");
    await expect(page.getByRole("heading", { name: "Locations" })).toBeVisible();
    await expect(page.getByText("Total Locations")).toBeVisible();

    await page.getByRole("button", { name: "Add Location" }).click();
    await page.getByLabel("Name").fill("Vancouver Pop-up");
    await page.getByRole("textbox", { name: "Code", exact: true }).fill("VAN-1");
    await chooseSelectOption(
      page,
      page.getByRole("combobox").filter({ hasText: "STORE" }),
      "POP UP",
    );
    await page.getByLabel("City").fill("Vancouver");
    await page.getByRole("button", { name: "Add Location" }).last().click();

    await expect(page.getByText("Vancouver Pop-up")).toBeVisible();

    await openRowActions(page, "Vancouver Pop-up");
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Name").fill("Vancouver Updated");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText("Vancouver Updated")).toBeVisible();

    await openRowActions(page, "Toronto Flagship");
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(
      page.getByText("Cannot delete a location with inventory on hand or historical orders"),
    ).toBeVisible();
  });
});
