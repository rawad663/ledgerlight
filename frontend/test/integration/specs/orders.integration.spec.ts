import { expect, test } from "../fixtures";
import { chooseSelectOption, expectToast, openRowActions } from "../helpers";

test.describe("frontend orders integration", () => {
  test("creates an order from the list page and exercises detail mutations", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "owner");

    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

    await page.getByRole("button", { name: "Create Order" }).click();
    await chooseSelectOption(
      page,
      page.getByRole("combobox").filter({ hasText: "Select location" }),
      "Toronto Flagship",
    );

    await page.getByRole("button", { name: "Add Item" }).click();
    await page
      .getByRole("dialog", { name: "Create Order" })
      .locator('button[role="combobox"]')
      .last()
      .click();
    await page.getByPlaceholder("Search products...").fill("Sticker");
    await page.getByText("Sticker Pack").click();
    await page.getByRole("button", { name: "Create Order" }).last().click();

    await expect(page).toHaveURL(/\/orders\/33333333-3333-3333-3333-/);
    await expect(page.getByText("Sticker Pack")).toBeVisible();
    await expect(page.getByText("No Payment").first()).toBeVisible();

    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByText("Select product...", { exact: true }).click();
    await page.getByPlaceholder("Search products...").fill("Coffee");
    await page.getByText("Coffee Beans").click();
    await page.getByLabel("Qty").fill("2");
    await page.getByRole("button", { name: "Save Item" }).click();

    await expect(page.getByText("Coffee Beans")).toBeVisible();

    await page.getByRole("button", { name: "Confirm Order" }).click();
    await expectToast(page, "Order marked as Confirmed");
    await expect(page.getByText("Unpaid").first()).toBeVisible();

    await page.getByRole("button", { name: "Process Payment" }).click();
    await page.getByRole("button", { name: "Mark Cash as Paid" }).click();
    await expectToast(page, "Payment recorded");
    await expect(page.getByText("Paid").first()).toBeVisible();

    await page.getByRole("button", { name: "Fulfill Order" }).click();
    await expectToast(page, "Order marked as Fulfilled");

    await page.getByRole("button", { name: "Refund" }).click();
    await page.getByLabel("Refund reason").fill("Customer changed their mind");
    await page.getByRole("button", { name: "Submit Refund" }).click();
    await expectToast(page, "Payment refunded");
    await expect(page.getByText("Refunded").first()).toBeVisible();
  });

  test("filters the list, shows payment state, and can cancel an existing order", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "owner");

    await page.goto("/orders");
    await page.getByPlaceholder("Search by order ID or customer...").fill("Jane");
    await expect(page).toHaveURL(/search=Jane/);
    await expect(page.getByText("Jane Doe")).toBeVisible();
    await expect(page.getByText("No Payment")).toBeVisible();

    await openRowActions(page, "Jane Doe");
    await page.getByRole("menuitem", { name: "Cancel order" }).click();
    await page.getByRole("button", { name: "Cancel order" }).last().click();

    await expectToast(page, "Order cancelled");
  });
});
