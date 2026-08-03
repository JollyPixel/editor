// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import { gotoDemo, setMode, clickTexturePixel, readPixel } from "./utils.ts";

// This file uses texture slice x:60-79, y:0-15 on the shared 80x80 canvas.
// Undo/redo stack is local per page load; only pixels are shared.

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

  // Canvas is already hovered, so keyboard shortcuts are accepted.
  await page.keyboard.press("Control+z");
  await expect.poll(
    () => readPixel(page, 67, 2)
  ).toMatchObject({ a: 0 });

  await page.keyboard.press("Control+y");
  await expect.poll(
    () => readPixel(page, 67, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
});
