import { expect, type Locator, type Page } from "@playwright/test";

export async function loginThroughUi(
  page: Page,
  email: string,
  password: string,
  returnTo?: string,
) {
  const loginUrl = returnTo
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/login";

  await page.goto(loginUrl);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

export async function chooseSelectOption(
  page: Page,
  trigger: Locator,
  optionText: string,
) {
  await trigger.click();

  const option = page.getByRole("option", { name: optionText }).first();

  if (await option.count()) {
    await option.click();
    return;
  }

  await page.getByText(optionText, { exact: true }).last().click();
}

export async function openRowActions(page: Page, rowText: string) {
  const row = page.locator("tr", { hasText: rowText }).first();

  await expect(row).toBeVisible();
  const namedButton = row.getByRole("button", { name: "Actions" });

  if (await namedButton.count()) {
    await namedButton.click();
    return row;
  }

  await row.getByRole("button").last().click();
  return row;
}

export async function openUserMenu(page: Page) {
  await page.locator("header").getByRole("button").last().click();
}

export async function expectToast(page: Page, text: string) {
  await expect(page.getByRole("listitem").getByText(text, { exact: true })).toBeVisible();
}
