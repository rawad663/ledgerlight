import { expect,test } from "../fixtures";

test.describe("frontend dashboard integration", () => {
  test("renders dashboard SSR data and refreshes the sales overview timeline", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "owner");

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Today's Sales")).toBeVisible();
    await expect(page.getByText("Low Stock Watchlist")).toBeVisible();
    await expect(page.getByText("Recent Orders")).toBeVisible();

    await page.getByRole("radio", { name: "Month timeline" }).click();

    await expect(page.getByText(/Confirmed and fulfilled sales/i)).toBeVisible();
    await expect(page.getByText(/\$182\.00/)).toBeVisible();
  });

  test("redirects roles without dashboard access to products", async ({
    page,
    scenario,
  }) => {
    await scenario.load("full-app");
    await scenario.setSession(page, "cashier");

    await page.goto("/");

    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  });
});
