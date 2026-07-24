// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode,
  dragStroke,
  clickTexturePixel,
  readPixel
} from "./utils.ts";

// This file uses texture slice x:40-59, y:0-15 on the shared 80x80 canvas.

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("creates a rectangle selection and moves it", async({ page }) => {
  await setMode(page, "paint");
  await clickTexturePixel(page, 42, 2);

  await setMode(page, "select");
  // Corners are exact. This box includes (42,2) on purpose.
  await dragStroke(page, [
    { x: 41, y: 1 },
    { x: 44, y: 4 }
  ]);
  await expect.poll(() => page.evaluate(() => {
    const panel = document.querySelector("pixel-draw-panel") as unknown as {
      canvasManager: { tools: { select: { hasSelection: boolean; }; }; };
    };

    return panel.canvasManager.tools.select.hasSelection;
  })).toBe(true);

  // Drag from inside selection = move it, not redraw it.
  await dragStroke(page, [
    { x: 42, y: 2 },
    { x: 42, y: 8 }
  ]);

  await expect.poll(
    () => readPixel(page, 42, 8)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect.poll(
    () => readPixel(page, 42, 2)
  ).toMatchObject({ a: 0 });
});

test("flips a selection horizontally", async({ page }) => {
  await setMode(page, "paint");
  await clickTexturePixel(page, 46, 2);

  await setMode(page, "select");
  // Use x:46-49 so flip mapping is obvious: offset 0 -> 3.
  await dragStroke(page, [
    { x: 46, y: 1 },
    { x: 49, y: 4 }
  ]);

  await page.keyboard.press("h");

  await expect.poll(
    () => readPixel(page, 49, 2)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect.poll(
    () => readPixel(page, 46, 2)
  ).toMatchObject({ a: 0 });
});

test("Delete erases the active selection", async({ page }) => {
  await setMode(page, "paint");
  await clickTexturePixel(page, 51, 2);

  await setMode(page, "select");
  await dragStroke(page, [
    { x: 51, y: 1 },
    { x: 52, y: 2 }
  ]);

  await page.keyboard.press("Delete");

  // Delete clears pixels, not selection state.
  await expect.poll(
    () => readPixel(page, 51, 2)
  ).toMatchObject({ a: 0 });
});
