// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode,
  dragStroke,
  clickTexturePixel,
  readPixel,
  setBrushColor
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// This file uses texture slice x:40-59, y:0-25 on the shared 80x80 canvas.

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("creates a rectangle selection and moves it", async({ page }) => {
  // Two dragStroke calls plus WebGL trace capture run close to the
  // default budget.
  test.slow();
  await setMode(page, "paint");
  await clickTexturePixel(page, 42, 2);

  await setMode(page, "select");
  // Corners are exact. This box includes (42,2) on purpose.
  await dragStroke(page, [
    { x: 41, y: 1 },
    { x: 44, y: 4 }
  ]);
  await expect.poll(() => page.evaluate(() => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");

    return panel!.canvasManager!.tools.select.hasSelection;
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

test("Ctrl+C / Ctrl+V duplicates the selection in place", async({ page }) => {
  // Same cost profile as the rect-select-and-move test above.
  test.slow();
  await setMode(page, "paint");
  await clickTexturePixel(page, 42, 16);

  await setMode(page, "select");
  await dragStroke(page, [
    { x: 41, y: 15 },
    { x: 44, y: 18 }
  ]);

  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");

  // A fresh paste doesn't erase its source when moved — dragging the
  // pasted copy away should leave the original pixel untouched.
  await dragStroke(page, [
    { x: 42, y: 16 },
    { x: 42, y: 21 }
  ]);

  await expect.poll(
    () => readPixel(page, 42, 21)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect.poll(
    () => readPixel(page, 42, 16)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
});

test("R rotates a non-square selection 90deg clockwise around its center", async({ page }) => {
  await setMode(page, "paint");
  await setBrushColor(page, "primary", "#000000");
  await clickTexturePixel(page, 46, 16);
  await setBrushColor(page, "primary", "#ff0000");
  await clickTexturePixel(page, 47, 16);

  await setMode(page, "select");
  await dragStroke(page, [
    { x: 46, y: 16 },
    { x: 47, y: 16 }
  ]);

  await page.keyboard.press("r");

  // Old 2-wide x 1-tall footprint is vacated except where the new
  // 1-wide x 2-tall footprint overlaps it.
  await expect.poll(
    () => readPixel(page, 46, 16)
  ).toMatchObject({ a: 0 });
  await expect.poll(
    () => readPixel(page, 47, 16)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect.poll(
    () => readPixel(page, 47, 17)
  ).toEqual({ r: 255, g: 0, b: 0, a: 255 });
});

test("V flips a selection vertically", async({ page }) => {
  await setMode(page, "paint");
  await setBrushColor(page, "primary", "#000000");
  await clickTexturePixel(page, 51, 16);
  await setBrushColor(page, "primary", "#ff0000");
  await clickTexturePixel(page, 51, 17);

  await setMode(page, "select");
  await dragStroke(page, [
    { x: 51, y: 16 },
    { x: 51, y: 17 }
  ]);

  await page.keyboard.press("v");

  await expect.poll(
    () => readPixel(page, 51, 16)
  ).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  await expect.poll(
    () => readPixel(page, 51, 17)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
});

test("Shape (magic-wand) selects a contiguous blob, and Delete only erases the masked pixels", async({ page }) => {
  // Several dragStroke/click calls plus WebGL trace capture run close to
  // the default budget.
  test.slow();
  await setMode(page, "paint");
  // A pixel inside the future bounding rect, but not part of the blob.
  await setBrushColor(page, "primary", "#00ffaa");
  await clickTexturePixel(page, 57, 3);

  // An L-shaped blob: (55,1)-(57,1), (55,2), (55,3).
  await setBrushColor(page, "primary", "#000000");
  await dragStroke(page, [
    { x: 55, y: 1 },
    { x: 57, y: 1 }
  ]);
  await clickTexturePixel(page, 55, 2);
  await clickTexturePixel(page, 55, 3);

  await setMode(page, "select");
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Select", exact: true }).hover();
  await page.getByRole("button", { name: "Shape" }).click();

  await clickTexturePixel(page, 56, 1);
  await expect.poll(() => page.evaluate(() => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");

    return panel!.canvasManager!.tools.select.hasSelection;
  })).toBe(true);

  await page.keyboard.press("Delete");

  await expect.poll(
    () => readPixel(page, 56, 1)
  ).toMatchObject({ a: 0 });
  await expect.poll(
    () => readPixel(page, 55, 3)
  ).toMatchObject({ a: 0 });
  // Bounding-rect corner that was never part of the blob: a mask-aware
  // delete must leave it untouched.
  await expect.poll(
    () => readPixel(page, 57, 3)
  ).toEqual({ r: 0, g: 255, b: 170, a: 255 });
});
