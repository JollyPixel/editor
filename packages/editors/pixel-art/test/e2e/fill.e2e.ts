// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  gotoDemo,
  setMode,
  dragStroke,
  clickTexturePixel,
  readPixel
} from "./utils.ts";

// This file uses texture slice x:20-39, y:0-15 on the shared 80x80 canvas.

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

function setBrushPrimary(
  page: Page,
  hex: string
): Promise<void> {
  return page.evaluate((color) => {
    const panel = document.querySelector("pixel-draw-panel") as unknown as {
      canvasManager: { brush: { primary: { set(hex: string, opacity?: number): void; }; }; };
    };
    panel.canvasManager.brush.primary.set(color, 1);
  }, hex);
}

test("contiguous fill stays inside a painted boundary", async({ page }) => {
  await setMode(page, "paint");
  // Build a ring wall first. Flood fill must stay boxed in.
  await dragStroke(page, [{ x: 21, y: 1 }, { x: 28, y: 1 }]);
  await dragStroke(page, [{ x: 28, y: 1 }, { x: 28, y: 8 }]);
  await dragStroke(page, [{ x: 28, y: 8 }, { x: 21, y: 8 }]);
  await dragStroke(page, [{ x: 21, y: 8 }, { x: 21, y: 1 }]);

  await setMode(page, "fill");
  await clickTexturePixel(page, 24, 4);

  await expect.poll(
    () => readPixel(page, 24, 4)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  // Outside ring: should stay transparent.
  await expect.poll(
    () => readPixel(page, 32, 4)
  ).toMatchObject({ a: 0 });
});

test("global fill recolors every matching pixel canvas-wide", async({ page }) => {
  // Seed with a weird color so global fill only hits pixels we painted.
  await setMode(page, "paint");
  await setBrushPrimary(page, "#123456");
  await clickTexturePixel(page, 24, 10);
  await clickTexturePixel(page, 26, 12);

  await setMode(page, "fill");
  // Flip mode: Neighbor -> Global.
  await page.locator(".tool-toggle-btn").click();
  await setBrushPrimary(page, "#654321");
  await clickTexturePixel(page, 24, 10);

  await expect.poll(
    () => readPixel(page, 24, 10)
  ).toEqual({ r: 0x65, g: 0x43, b: 0x21, a: 255 });
  await expect.poll(
    () => readPixel(page, 26, 12)
  ).toEqual({ r: 0x65, g: 0x43, b: 0x21, a: 255 });
  // Unpainted pixel: must remain untouched.
  await expect.poll(
    () => readPixel(page, 25, 11)
  ).toMatchObject({ a: 0 });
});
