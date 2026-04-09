import { expect,test } from "../fixtures";
import { chooseSelectOption, expectToast, openRowActions } from "../helpers";

test.describe("frontend inventory integration", () => {
  test("filters inventory and adjusts stock through the sheet", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "owner");

    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    await expect(page.getByText("Low Stock Alert")).toBeVisible();

    await page.getByRole("button", { name: "View Items" }).click();
    await expect(page).toHaveURL(/lowStockOnly=true/);

    await chooseSelectOption(
      page,
      page.getByRole("combobox").filter({ hasText: "All Locations" }),
      "Toronto Flagship",
    );
    await expect(page).toHaveURL(/locationId=loc-1/);

    await openRowActions(page, "Essential Tee");
    await page.getByRole("menuitem", { name: "Adjust quantity" }).click();
    await page.getByLabel("Quantity Change").fill("6");
    await page.getByRole("button", { name: "Submit Adjustment" }).click();

    await expectToast(page, "Stock adjusted");
    await expect(page.locator("tr", { hasText: "Essential Tee" }).getByText("10")).toBeVisible();
  });

  test("surfaces validation errors when an adjustment would go below zero", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "owner");

    await page.goto("/inventory");
    await openRowActions(page, "Essential Tee");
    await page.getByRole("menuitem", { name: "Adjust quantity" }).click();
    await page.getByLabel("Quantity Change").fill("-50");
    await page.getByRole("button", { name: "Submit Adjustment" }).click();

    await expect(page.getByText("Inventory cannot go below zero")).toBeVisible();
  });
});
