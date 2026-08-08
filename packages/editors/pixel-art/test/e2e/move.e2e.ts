// Import Third-party Dependencies
import { test, expect, type Page } from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode,
  textureToScreenPoint
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// Viewport state resets on each page load.

async function readViewport(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");
    const { viewport } = panel!.canvasManager!;

    return {
      camera: { ...viewport.camera },
      zoom: viewport.zoom.value
    };
  });
}

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("Move mode pans the canvas via left-drag", async({ page }) => {
  await setMode(page, "move");

  const before = await readViewport(page);
  const anchor = await textureToScreenPoint(page, 40, 40);

  await page.mouse.move(anchor.x, anchor.y);
  await page.mouse.down();
  await page.mouse.move(anchor.x + 40, anchor.y + 20, { steps: 8 });
  await page.mouse.up();

  const after = await readViewport(page);
  expect(after.camera.x - before.camera.x).toBeCloseTo(40, 0);
  expect(after.camera.y - before.camera.y).toBeCloseTo(20, 0);
});

test("wheel zooms the viewport out", async({ page }) => {
  const before = await readViewport(page);
  const anchor = await textureToScreenPoint(page, 40, 40);

  await page.mouse.move(anchor.x, anchor.y);
  // Positive deltaY zooms out.
  await page.mouse.wheel(0, 500);

  const after = await readViewport(page);
  expect(after.zoom).toBeLessThan(before.zoom);
});
