import { expect,test } from "../fixtures";
import { chooseSelectOption, openRowActions } from "../helpers";

test.describe("frontend products integration", () => {
  test("filters, creates with inventory, handles duplicate SKU, edits, and deactivates products", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "owner");

    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    await page.getByRole("button", { name: "Add Product" }).click();
    await page.getByLabel("Name").fill("Travel Mug");
    await page.getByLabel("SKU").fill("MUG-001");
    await page.getByLabel("Price ($)").fill("22.00");
    await page.getByLabel("Reorder Threshold").fill("8");
    await chooseSelectOption(
      page,
      page.getByRole("combobox").nth(0),
      "Apparel",
    );
    await chooseSelectOption(
      page,
      page.getByRole("combobox").nth(1),
      "Toronto Flagship",
    );
    await page.getByLabel("Quantity").fill("15");
    await page.getByRole("button", { name: "Create Product" }).click();

    await expect(page.getByText("Travel Mug")).toBeVisible();

    await page.getByRole("button", { name: "Add Product" }).click();
    await page.getByLabel("Name").fill("Duplicate Mug");
    await page.getByLabel("SKU").fill("MUG-001");
    await page.getByLabel("Price ($)").fill("19.00");
    await page.getByLabel("Reorder Threshold").fill("5");
    await page.getByRole("button", { name: "Create Product" }).click();
    await expect(page.getByText("A product with this SKU already exists")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByPlaceholder("Search products by name or SKU...").fill("Travel");
    await expect(page).toHaveURL(/search=Travel/);

    await openRowActions(page, "Travel Mug");
    await page.getByRole("menuitem", { name: "Edit product" }).click();
    await page.getByLabel("Name").fill("Travel Mug Pro");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText("Travel Mug Pro")).toBeVisible();

    await openRowActions(page, "Travel Mug Pro");
    await page.getByRole("menuitem", { name: "Deactivate product" }).click();
    await page.getByRole("button", { name: "Deactivate" }).click();

    await expect(page.getByText("No products found")).toBeVisible();
  });
});
