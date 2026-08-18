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
  clickTexturePixel,
  readPixel,
  setBrushColor
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

// Uses texture slice x:0-19, y:20-35; pixel (10,25) verifies paint output.

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

async function readBrush(
  page: Page
) {
  return page.evaluate(() => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");
    const { brush } = panel!.canvasManager!;

    return {
      primary: brush.primary.asString("hex").toLowerCase(),
      secondary: brush.secondary.asString("hex").toLowerCase()
    };
  });
}

test("picking a foreground color via the swatch updates the brush and the paint", async({ page }) => {
  await setMode(page, "paint");

  // Hit the real swatch UI.
  // Both pickers live in document.body, so target the visible input.
  await page.locator("color-swatch.fg").locator("button").click();
  await page.locator("jolly-color-picker input.hex:visible").fill("#ff00ff");
  await page.locator("jolly-color-picker input.hex:visible").press("Enter");

  await expect.poll(
    () => readBrush(page).then((b) => b.primary)
  ).toBe("#ff00ff");

  await clickTexturePixel(page, 10, 25);
  await expect.poll(
    () => readPixel(page, 10, 25)
  ).toEqual({ r: 255, g: 0, b: 255, a: 255 });
});

test("the eyedropper picks a canvas pixel into the primary color", async({ page }) => {
  await setMode(page, "paint");
  await setBrushColor(page, "primary", "#3355ff");
  await clickTexturePixel(page, 5, 30);
  await setBrushColor(page, "primary", "#000000");

  // Arm via the Paint mode button's flyout, not the internal API.
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Paint", exact: true }).hover();
  await page.getByRole("button", { name: "Pick color" }).click();

  // This click samples the pixel — it must not also paint over it.
  await clickTexturePixel(page, 5, 30);
  await expect.poll(
    () => readBrush(page).then((b) => b.primary)
  ).toBe("#3355ff");
  await expect.poll(
    () => readPixel(page, 5, 30)
  ).toEqual({ r: 0x33, g: 0x55, b: 0xff, a: 255 });

  // Picking disarms the tool: the next click paints normally, with the
  // freshly-picked color.
  await clickTexturePixel(page, 15, 32);
  await expect.poll(
    () => readPixel(page, 15, 32)
  ).toEqual({ r: 0x33, g: 0x55, b: 0xff, a: 255 });
});

test("the swap button exchanges foreground and background colors", async({ page }) => {
  await page.evaluate(() => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");
    const { brush } = panel!.canvasManager!;
    brush.primary.set("#111111", 1);
    brush.secondary.set("#222222", 1);
  });

  await page.getByRole("button", {
    name: "Swap foreground and background colors"
  }).click();

  const brush = await readBrush(page);
  expect(brush.primary).toBe("#222222");
  expect(brush.secondary).toBe("#111111");
});
