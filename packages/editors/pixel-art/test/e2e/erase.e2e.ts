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

// This file uses texture slice x:0-15, y:40-55 on the shared 80x80 canvas.

const kBlack = {
  r: 0,
  g: 0,
  b: 0,
  a: 255
};

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("erases a painted stroke back to transparency", async({ page }) => {
  await setMode(page, "paint");
  await dragStroke(page, [
    { x: 2, y: 42 },
    { x: 2, y: 43 },
    { x: 2, y: 44 }
  ]);
  await expect.poll(
    () => readPixel(page, 2, 43)
  ).toEqual(kBlack);

  await setMode(page, "erase");
  await dragStroke(page, [
    { x: 2, y: 42 },
    { x: 2, y: 43 },
    { x: 2, y: 44 }
  ]);

  for (let y = 42; y <= 44; y++) {
    await expect.poll(
      () => readPixel(page, 2, y)
    ).toMatchObject({ a: 0 });
  }
});

test("right-click erases instead of painting the secondary color", async({ page }) => {
  await setMode(page, "paint");
  await clickTexturePixel(page, 6, 47);
  await expect.poll(
    () => readPixel(page, 6, 47)
  ).toEqual(kBlack);

  await setMode(page, "erase");
  await clickTexturePixel(page, 6, 47, "right");

  await expect.poll(
    () => readPixel(page, 6, 47)
  ).toMatchObject({ a: 0 });
});

test("keeps the brush size option available in erase mode", async({ page }) => {
  await setMode(page, "erase");
  const sizeSlider = page.locator(".tool-option-overlay input[type=\"range\"]");
  await expect(sizeSlider).toBeVisible();

  await sizeSlider.evaluate((el, value) => {
    const input = el as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(
      new Event("input", { bubbles: true })
    );
  }, 4);

  await setMode(page, "paint");
  await clickTexturePixel(page, 12, 52);
  await expect.poll(
    () => readPixel(page, 10, 50)
  ).toEqual(kBlack);

  await setMode(page, "erase");
  await clickTexturePixel(page, 12, 52);

  await expect.poll(
    () => readPixel(page, 10, 50)
  ).toMatchObject({ a: 0 });
  await expect.poll(
    () => readPixel(page, 13, 53)
  ).toMatchObject({ a: 0 });
});
