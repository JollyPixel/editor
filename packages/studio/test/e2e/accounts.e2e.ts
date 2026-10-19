// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  registerAccount,
  uniqueUsername
} from "./support/account.ts";

// CONSTANTS
const kOnePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test("creates an account from the dialog, then signs out", async({ studio }) => {
  const username = uniqueUsername();
  await studio.goto();

  await studio.signIn.register(username);
  await expect(studio.account.root).toContainText(username);

  await studio.account.signOut(username);
  await expect(studio.signIn.root).toBeVisible();
});

test("uploads an avatar from Settings, opened from the account menu", async({ studio, account }) => {
  await studio.goto();

  await studio.account.openSettings(account);
  await studio.settings.changeAvatar(kOnePixelPng);

  const avatar = /\/avatar\?v=[0-9a-f]{16}$/;
  await expect(studio.account.avatar).toHaveAttribute("src", avatar);
  await expect(studio.roster.avatar).toHaveAttribute("src", avatar);
});

test("signs back in with the password an account registered with", async({ studio, request }) => {
  const username = await registerAccount(request);
  await studio.goto();

  await studio.signIn.signIn(username.toUpperCase());

  await expect(studio.account.root).toContainText(username);
});

test("lists the signed-in user online under its role", async({ studio, account }) => {
  await studio.goto();

  await expect(studio.roster.row(/Member/)).toBeVisible();
  await expect(
    studio.roster.row(new RegExp(account)).getByRole("img", { name: "Online" })
  ).toBeVisible();
});
