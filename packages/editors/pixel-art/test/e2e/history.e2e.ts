// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode,
  clickTexturePixel,
  readPixel
} from "./utils.ts";

// Uses texture slice x:60-79, y:0-15; undo/redo is page-local.

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
  await setMode(page, "paint");
});

test("Undo/redo buttons revert and reapply a stroke", async({ page }) => {
  const undoButton = page.getByRole("button", { name: "Undo" });
  const redoButton = page.getByRole("button", { name: "Redo" });

  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeDisabled();

  await clickTexturePixel(page, 65, 2);
  await expect.poll(
    () => readPixel(page, 65, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect(undoButton).toBeEnabled();

  await undoButton.click();
  await expect.poll(
    () => readPixel(page, 65, 2)
  ).toMatchObject({ a: 0 });
  await expect(redoButton).toBeEnabled();

  await redoButton.click();
  await expect.poll(
    () => readPixel(page, 65, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
});

test("mod+z / mod+y keyboard shortcuts undo and redo", async({ page }) => {
  await clickTexturePixel(page, 67, 2);
  await expect.poll(
    () => readPixel(page, 67, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });

  // Canvas is already hovered, so shortcuts work.
  await page.keyboard.press("Control+z");
  await expect.poll(
    () => readPixel(page, 67, 2)
  ).toMatchObject({ a: 0 });

  await page.keyboard.press("Control+y");
  await expect.poll(
    () => readPixel(page, 67, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
});

test("Clear texture leaves the texture unchanged when cancelled", async({ page }) => {
  await clickTexturePixel(page, 69, 2);
  await expect.poll(
    () => readPixel(page, 69, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });

  await page.getByRole("button", { name: "Clear texture" }).click();
  const dialog = page.locator("jolly-dialog");
  await expect(dialog).toContainText("Clear texture");
  await expect(dialog).toContainText(
    "Clear the entire texture and make every pixel transparent?"
  );
  await expect.poll(
    () => readPixel(page, 69, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });

  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(
    () => readPixel(page, 69, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled();
});

test("Clear texture replaces the texture after confirmation", async({ page }) => {
  await clickTexturePixel(page, 71, 2);
  await expect.poll(
    () => readPixel(page, 71, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });

  await page.getByRole("button", { name: "Clear texture" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect.poll(
    () => readPixel(page, 71, 2)
  ).toMatchObject({ a: 0 });
});
