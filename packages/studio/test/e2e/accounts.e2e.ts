// Import Third-party Dependencies
import {
  expect,
  test,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  E2E_PASSWORD,
  registerAccount,
  uniqueUsername
} from "./support/account.ts";

function signInDialog(
  page: Page
) {
  return page.getByRole("dialog", { name: "Sign in" });
}

async function fillCredentials(
  page: Page,
  username: string
): Promise<void> {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
}

test("creates an account from the dialog, then signs out", async({ page }) => {
  const username = uniqueUsername();
  await page.goto("/");

  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await fillCredentials(page, username);
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  const badge = page.locator("#studio-actions studio-account");
  await expect(badge).toContainText(username);
  await badge.getByRole("button", { name: "Sign out" }).click();
  await expect(signInDialog(page)).toBeVisible();
});

test("signs back in with the password an account registered with", async({ page, request }) => {
  const username = uniqueUsername();
  await registerAccount(request, username);
  await page.goto("/");

  await fillCredentials(page, username.toUpperCase());
  await page.getByLabel("Password").press("Enter");

  await expect(page.locator("#studio-actions studio-account")).toContainText(username);
});

test("lists the signed-in user online under its role", async({ page }) => {
  const username = await registerAccount(page.request);
  await page.goto("/");

  const users = page.locator("studio-users jolly-tree");
  await expect(users.getByRole("treeitem", { name: /Member/ })).toBeVisible();
  await expect(users.getByRole("treeitem", { name: new RegExp(username) })).toContainText("you");
});
