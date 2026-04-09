import { expect,test } from "../fixtures";
import { openRowActions } from "../helpers";

test.describe("frontend customers integration", () => {
  test("lists, filters, creates, edits, and deletes customers", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "owner");

    await page.goto("/customers");
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
    await expect(page.getByText("Jane Doe")).toBeVisible();

    await page.getByPlaceholder("Search by name, email, or phone...").fill("Sam");
    await expect(page).toHaveURL(/search=Sam/);
    await expect(page.getByText("Sam Carter")).toBeVisible();
    await expect(page.getByText("Jane Doe")).not.toBeVisible();
    await page.getByPlaceholder("Search by name, email, or phone...").fill("");
    await expect(page).toHaveURL(/\/customers$/);

    await page.getByRole("button", { name: "Add Customer" }).click();
    await page.getByLabel("Name").fill("Avery Quinn");
    await page.getByLabel("Email").fill("avery@example.com");
    await page.getByLabel("Phone (optional)").fill("647-555-0199");
    await page.getByRole("button", { name: "Add Customer" }).last().click();
    await page.getByPlaceholder("Search by name, email, or phone...").fill("");

    await expect(page.getByText("Avery Quinn")).toBeVisible();

    await openRowActions(page, "Avery Quinn");
    await page.getByRole("menuitem", { name: "Edit customer" }).click();
    await page.getByLabel("Name").fill("Avery Updated");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.getByText("Avery Updated")).toBeVisible();

    await openRowActions(page, "Avery Updated");
    await page.getByRole("menuitem", { name: "Delete customer" }).click();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.locator("tbody").getByText("Avery Updated")).not.toBeVisible();
  });
});
