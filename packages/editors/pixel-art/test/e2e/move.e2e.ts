// Import Third-party Dependencies
import type { Locator } from "@playwright/test";

// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  hoverTexturePixel,
  setMode,
  textureToScreenPoint
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

function readViewport(
  panel: Locator
) {
  return panel.evaluate((element: PixelDrawPanel) => {
    const { viewport } = element.canvasManager!;

    return {
      camera: { ...viewport.camera },
      zoom: viewport.zoom.value
    };
  });
}

test("Move mode pans the canvas with a left drag", async({ panel, page }) => {
  await setMode(panel, "move");
  const before = await readViewport(panel);
  const anchor = await textureToScreenPoint(panel, { x: 40, y: 40 });

  await page.mouse.move(anchor.x, anchor.y);
  await page.mouse.down();
  await page.mouse.move(anchor.x + 40, anchor.y + 20, { steps: 8 });
  await page.mouse.up();

  const after = await readViewport(panel);
  expect(after.camera.x - before.camera.x).toBeCloseTo(40, 0);
  expect(after.camera.y - before.camera.y).toBeCloseTo(20, 0);
  expect(after.zoom).toBe(before.zoom);
});

test("the wheel zooms out", async({ panel, page }) => {
  const before = await readViewport(panel);
  await hoverTexturePixel(panel, { x: 40, y: 40 });

  await page.mouse.wheel(0, 500);

  await expect.poll(async() => (await readViewport(panel)).zoom)
    .toBeLessThan(before.zoom);
});
