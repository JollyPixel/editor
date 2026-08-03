// Import Third-party Dependencies
import {
  test,
  expect,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import { gotoDemo, setMode, clickTexturePixel, readPixel } from "./utils.ts";

// This file uses texture slice x:0-19, y:20-35 on the shared 80x80 canvas.
// Marker pixel at (10,25) proves swatch color really reaches paint output.

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

async function readBrush(
  page: Page
) {
  return page.evaluate(() => {
    const panel = document.querySelector("pixel-draw-panel") as unknown as {
      canvasManager: {
        brush: {
          primary: {
            asString(format: "hex"): string;
          };
          secondary: {
            asString(format: "hex"): string;
          };
        };
      };
    };
    const { brush } = panel.canvasManager;

    return {
      primary: brush.primary.asString("hex").toLowerCase(),
      secondary: brush.secondary.asString("hex").toLowerCase()
    };
  });
}

test("picking a foreground color via the swatch updates the brush and the paint", async({ page }) => {
  await setMode(page, "paint");

  // Hit real swatch UI.
  // Pickers live in document.body and both exist, so target visible input only.
  await page.locator("color-swatch.fg").locator("button").click();
  await page.locator(".picker_editor input:visible").fill("#ff00ff");

  await expect.poll(
    () => readBrush(page).then((b) => b.primary)
  ).toBe("#ff00ff");

  await clickTexturePixel(page, 10, 25);
  await expect.poll(
    () => readPixel(page, 10, 25)
  ).toEqual({ r: 255, g: 0, b: 255, a: 255 });
});

test("the swap button exchanges foreground and background colors", async({ page }) => {
  await page.evaluate(() => {
    const panel = document.querySelector("pixel-draw-panel") as unknown as {
      canvasManager: {
        brush: {
          primary: { set(hex: string, opacity?: number): void; };
          secondary: { set(hex: string, opacity?: number): void; };
        };
      };
    };
    panel.canvasManager.brush.primary.set("#111111", 1);
    panel.canvasManager.brush.secondary.set("#222222", 1);
  });

  await page.getByRole("button", {
    name: "Swap foreground and background colors"
  }).click();

  const brush = await readBrush(page);
  expect(brush.primary).toBe("#222222");
  expect(brush.secondary).toBe("#111111");
});
