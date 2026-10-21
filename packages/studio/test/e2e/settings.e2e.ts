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

test("reopens Settings on its last section after a reload", async({ studio, account, page }) => {
  await studio.goto();
  await studio.account.openSettings(account);
  await studio.settings.editor("pixel-art").click();
  await page.reload();

  await expect(studio.settings.root).toBeVisible();
  await expect(studio.settings.editor("pixel-art"))
    .toHaveAttribute("aria-current", "page");
  await expect(studio.settings.root.getByRole("heading", {
    name: "Pixel art",
    level: 2
  }))
    .toBeVisible();
});

test("puts shortcuts beside the preferences on a wide page", async({ studio, account, page }) => {
  await page.setViewportSize({
    width: 1600,
    height: 900
  });
  await studio.goto();
  await studio.account.openSettings(account);
  await studio.settings.editor("pixel-art").click();
  const preferences = studio.settings.column("preferences");
  const shortcuts = studio.settings.column("shortcuts");

  await expect.poll(async() => {
    const [left, right] = await Promise.all([
      preferences.boundingBox(),
      shortcuts.boundingBox()
    ]);

    return right !== null && left !== null && right.x >= left.x + left.width;
  }).toBe(true);

  await page.setViewportSize({
    width: 900,
    height: 900
  });
  await expect.poll(async() => {
    const [top, bottom] = await Promise.all([
      preferences.boundingBox(),
      shortcuts.boundingBox()
    ]);

    return bottom !== null && top !== null && bottom.y >= top.y + top.height;
  }).toBe(true);
});

test("rebinds a shortcut and refuses a chord another action holds", async({ studio, account, page }) => {
  await studio.goto();
  await studio.account.openSettings(account);
  await studio.settings.editor("pixel-art").click();
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

test("binds a camera move to a modifier pressed alone", async({ studio, account, page }) => {
  await studio.goto();
  await studio.account.openSettings(account);
  await studio.settings.section("Camera").click();
  const down = studio.settings.shortcut("camera", "down");

  await down.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("Control");
  await expect(down.locator("kbd")).toHaveText(["Ctrl"]);

  await expect.poll(() => page.evaluate(async() => {
    const response = await fetch("/api/preferences/");

    return response.json();
  })).toEqual({
    scopes: {
      camera: { down: ["ControlLeft", "ControlRight"] }
    }
  });
});

test("warns when a camera key also triggers an editor shortcut", async({ studio, account, page }) => {
  await studio.goto();
  await studio.account.openSettings(account);
  await studio.settings.section("Camera").click();
  const forward = studio.settings.shortcut("camera", "forward");

  await forward.getByRole("button", { name: "Change" }).click();
  await page.keyboard.press("KeyR");

  await expect(studio.settings.root.locator("[data-clash=forward]"))
    .toContainText("\"Rotate clockwise\" (Pixel art)");
});
