// Import Third-party Dependencies
import {
  test,
  expect
} from "@playwright/test";

// Import Internal Dependencies
import { gotoGallery } from "../../support/gallery.ts";

test.describe("Dialog", () => {
  test("native Escape dismisses a declarative dialog", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/dialog",
      chrome: "off",
      theme: "dark"
    });

    await expect(page.locator("main > .chrome-row > jolly-button"))
      .toHaveCount(4);
    await page.getByRole("button", { name: "Open dialog" }).click();
    const host = page.locator("#delete-dialog");
    const dialog = host.locator("dialog");
    await expect(dialog).toHaveAttribute("open");
    await expect(host).toHaveAttribute("theme", "dark");
    await expect(host.locator(":scope > jolly-button"))
      .toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open");
  });

  test("an open dialog claims keys from document listeners", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/dialog-escape",
      chrome: "off"
    });

    const example = page.locator("main > .chrome-row");
    const dialog = example.locator("jolly-dialog dialog");
    await page.getByRole("button", { name: "Open dismissible dialog" }).click();
    await expect(dialog).toHaveAttribute("open");

    await page.keyboard.press("KeyW");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open");
    await expect(example).toHaveAttribute("data-viewport-keys", "");

    await page.keyboard.press("Escape");
    await expect(example).toHaveAttribute("data-viewport-keys", "Escape");
  });

  test("an open popover claims the Escape that closes it", async({ page }) => {
    await gotoGallery(page, {
      example: "scenarios/dialog-escape",
      chrome: "off"
    });

    const example = page.locator("main > .chrome-row");
    const field = example.locator("jolly-color");
    await field.locator("button.swatch").click();
    const popover = field.locator(".popover");
    await expect(popover).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(example).toHaveAttribute("data-viewport-keys", "");

    await page.keyboard.press("Escape");
    await expect(example).toHaveAttribute("data-viewport-keys", "Escape");
  });

  test("helpers settle, trim prompts, and remove themselves", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/dialog",
      chrome: "off",
      theme: "dark"
    });

    const example = page.locator("main > div");
    await page.locator("[data-action=prompt-helper]").click();
    const prompt = page.locator("body > jolly-dialog");
    await expect(prompt).toHaveAttribute("theme", "dark");
    await expect(prompt.locator("jolly-text")).toHaveCount(1);
    await expect(prompt.locator("jolly-button")).toHaveCount(2);
    await prompt.locator("input").fill("  Layer  ");
    await prompt.locator("input").press("Enter");
    await expect(example).toHaveAttribute("data-result", "Layer");
    await expect(prompt).toHaveCount(0);

    await page.locator("[data-action=confirm-helper]").click();
    const confirm = page.locator("body > jolly-dialog");
    await page.keyboard.press("Escape");
    await expect(example).toHaveAttribute("data-result", "false");
    await expect(confirm).toHaveCount(0);
  });

  test("Enter confirms the helper dialogs", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/dialog",
      chrome: "off",
      theme: "dark"
    });

    const example = page.locator("main > div");
    await page.locator("[data-action=confirm-helper]").click();
    const confirm = page.locator("body > jolly-dialog");
    await page.keyboard.press("Enter");
    await expect(example).toHaveAttribute("data-result", "true");
    await expect(confirm).toHaveCount(0);
  });

  test("Enter runs the default action from a field", async({ page }) => {
    await gotoGallery(page, {
      example: "containers/dialog",
      chrome: "off",
      theme: "dark"
    });

    const example = page.locator("main > div");
    await page.locator("[data-action=default-action]").click();
    const dialog = page.locator("#rename-dialog");
    const input = dialog.locator("input");
    await expect(input).toBeFocused();
    await input.fill("Ground");
    await input.press("Enter");
    await expect(example).toHaveAttribute("data-result", "renamed:Ground");
    await expect(dialog.locator("dialog")).not.toHaveAttribute("open");
  });
});
