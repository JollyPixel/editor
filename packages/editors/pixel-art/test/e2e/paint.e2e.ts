// Import Third-party Dependencies
import { test, expect } from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode,
  dragStroke,
  clickTexturePixel,
  textureToScreenPoint,
  readPixel
} from "./utils.ts";

// This file uses texture slice x:0-15, y:0-15 on the shared 80x80 canvas.
// Tests also keep mini-zones separate so order never matters.

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
  await setMode(page, "paint");
});

test("draws a freehand stroke in the primary color", async({ page }) => {
  // Default brush: size 1, black.
  await dragStroke(page, [
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 2, y: 4 }
  ]);

  for (let y = 2; y <= 4; y++) {
    await expect.poll(
      () => readPixel(page, 2, y)
    ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  }
  // Neighbor column should stay empty.
  await expect.poll(
    () => readPixel(page, 3, 2)
  ).toMatchObject({ a: 0 });
});

test("brush size widens the painted footprint", async({ page }) => {
  const sizeSlider = page.locator(".tool-option-overlay input[type=\"range\"]");
  await sizeSlider.evaluate((el, value) => {
    const input = el as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, 4);

  // Even-size brush shifts toward origin: size 4 at (6,6) covers 4..7.
  await clickTexturePixel(page, 6, 6);

  await expect.poll(
    () => readPixel(page, 4, 4)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect.poll(
    () => readPixel(page, 7, 7)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect.poll(
    () => readPixel(page, 3, 3)
  ).toMatchObject({ a: 0 });
  await expect.poll(
    () => readPixel(page, 8, 8)
  ).toMatchObject({ a: 0 });
});

test("Shift arms a straight line between two points", async({ page }) => {
  const start = { x: 2, y: 10 };
  const end = { x: 8, y: 10 };

  const startPoint = await textureToScreenPoint(page, start.x, start.y);
  const endPoint = await textureToScreenPoint(page, end.x, end.y);

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.keyboard.down("Shift");
  await page.mouse.move(endPoint.x, endPoint.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.up("Shift");

  for (let x = start.x; x <= end.x; x++) {
    await expect.poll(
      () => readPixel(page, x, 10)
    ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  }
});
