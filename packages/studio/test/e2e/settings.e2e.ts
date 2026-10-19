// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";

test("keeps the theme on the account, not in the browser", async({ studio, account, page }) => {
  await studio.goto();
  await studio.account.openSettings(account);
  await studio.settings.section("Appearance").click();

  await studio.settings.field("theme").getByRole("combobox")
    .selectOption({ label: "Dark" });
  await expect(studio.theme).toHaveAttribute("theme", "dark");
  await expect.poll(() => page.evaluate(async() => {
    const response = await fetch("/api/preferences/");

    return response.json();
  })).toEqual({ scopes: { studio: { theme: "dark" } } });
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(studio.theme).toHaveAttribute("theme", "dark");
});

test("rebinds a shortcut and refuses a chord another action holds", async({ studio, account, page }) => {
  await studio.goto();
  await studio.account.openSettings(account);
  await studio.settings.section("Keybindings").click();
  const rotate = studio.settings.shortcut("pixel-art-keybindings", "rotate");
  const flip = studio.settings.shortcut("pixel-art-keybindings", "flipHorizontal");

  await rotate.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("e");
  await expect(rotate.locator("kbd")).toHaveText(["E"]);

  await flip.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("v");
  await expect(studio.settings.root.getByRole("alert")).toHaveText(
    "V is already bound to \"Flip vertically\"."
  );
  await expect(flip.locator("kbd")).toHaveText(["H"]);

  await expect.poll(() => page.evaluate(async() => {
    const response = await fetch("/api/preferences/");

    return response.json();
  })).toEqual({
    scopes: {
      "pixel-art-keybindings": { rotate: ["e"] }
    }
  });
});
