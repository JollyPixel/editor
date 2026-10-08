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

// CONSTANTS
const kOnePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

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
  await badge.getByRole("button", { name: username }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(signInDialog(page)).toBeVisible();
});

test("uploads an avatar from the account menu", async({ page }) => {
  const username = await registerAccount(page.request);
  await page.goto("/");

  const badge = page.locator("#studio-actions studio-account");
  const chooser = page.waitForEvent("filechooser");
  await badge.getByRole("button", { name: username }).click();
  await page.getByRole("menuitem", { name: "Change avatar…" }).click();
  await (await chooser).setFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: kOnePixelPng
  });

  const avatar = /\/avatar\?v=[0-9a-f]{16}$/;
  await expect(badge.locator("jolly-avatar img")).toHaveAttribute("src", avatar);
  await expect(
    page.locator("studio-users jolly-tree jolly-avatar img")
  ).toHaveAttribute("src", avatar);
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
