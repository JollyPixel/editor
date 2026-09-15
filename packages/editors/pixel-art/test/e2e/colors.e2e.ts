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

  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Paint", exact: true }).hover();
  await page.getByRole("button", { name: "Pick color" }).click();

  await clickTexturePixel(page, 5, 30);
  await expect.poll(
    () => readBrush(page).then((b) => b.primary)
  ).toBe("#3355ff");
  await expect.poll(
    () => readPixel(page, 5, 30)
  ).toEqual({ r: 0x33, g: 0x55, b: 0xff, a: 255 });

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

async function dockPicker(
  page: Page
): Promise<void> {
  await page.getByRole("button", { name: "Docked color picker" }).click();
  await expect(page.locator("color-dock")).toBeVisible();
}

test("docking the picker disables the swatches and shares one color", async({ page }) => {
  await setBrushColor(page, "primary", "#123456");
  await setBrushColor(page, "secondary", "#abcdef");
  const stage = page.locator(".stage");
  const undockedHeight = await stage.evaluate((element) => element.clientHeight);

  await dockPicker(page);

  await expect(
    page.getByRole("button", { name: "Docked color picker" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("color-swatch.fg button")).toBeDisabled();
  await expect(page.locator("color-swatch.bg button")).toBeDisabled();
  await expect(page.getByRole("button", {
    name: "Swap foreground and background colors"
  })).toBeDisabled();
  await expect.poll(() => readBrush(page)).toEqual({
    primary: "#123456",
    secondary: "#123456"
  });
  expect(
    await stage.evaluate((element) => element.clientHeight)
  ).toBeLessThan(undockedHeight);
});

test("the docked picker paints its color with both mouse buttons", async({ page }) => {
  await setMode(page, "paint");
  await dockPicker(page);

  const hex = page.locator("color-dock jolly-color-picker input.hex");
  await hex.fill("#ff00ff");
  await hex.press("Enter");

  await expect.poll(() => readBrush(page)).toEqual({
    primary: "#ff00ff",
    secondary: "#ff00ff"
  });

  await clickTexturePixel(page, 12, 28, "right");
  await expect.poll(
    () => readPixel(page, 12, 28)
  ).toEqual({ r: 255, g: 0, b: 255, a: 255 });
});

test("undocking restores the background color", async({ page }) => {
  await setBrushColor(page, "secondary", "#222222");
  await page.evaluate(() => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
    const collected: boolean[] = [];
    Object.assign(window, { dockEvents: collected });
    panel.addEventListener("color-docked-change", (event) => {
      collected.push(event.detail);
    });
  });

  await dockPicker(page);
  await page.getByRole("button", { name: "Docked color picker" }).click();

  await expect(page.locator("color-dock")).toHaveCount(0);
  await expect(page.locator("color-swatch.bg button")).toBeEnabled();
  expect(
    await page.evaluate(() => Reflect.get(window, "dockEvents"))
  ).toEqual([true, false]);
  expect((await readBrush(page)).secondary).toBe("#222222");
});

test("the color-docked property opens the docked picker", async({ page }) => {
  await page.evaluate(() => {
    document.querySelector<PixelDrawPanel>("pixel-draw-panel")!.colorDocked = true;
  });

  await expect(page.locator("color-dock")).toBeVisible();
  await expect(page.locator("pixel-draw-panel")).toHaveAttribute("color-docked", "");
});
