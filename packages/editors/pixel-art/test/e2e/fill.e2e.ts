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
  readPixel,
  setBrushColor
} from "./utils.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

async function addUvRegion(
  page: Page,
  rect: { x: number; y: number; width: number; height: number; }
): Promise<void> {
  await page.evaluate((regionRect) => {
    const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel");
    panel!.canvasManager!.uv.restore({
      id: "fill-clip-slot",
      color: "#00ffff",
      state: "stacked",
      rect: regionRect
    });
  }, rect);
}

test.beforeEach(async({ page }) => {
  await gotoDemo(page);
});

test("contiguous fill stays inside a painted boundary", async({ page }) => {
  test.slow();
  await setMode(page, "paint");
  await dragStroke(page, [{ x: 21, y: 1 }, { x: 28, y: 1 }]);
  await dragStroke(page, [{ x: 28, y: 1 }, { x: 28, y: 8 }]);
  await dragStroke(page, [{ x: 28, y: 8 }, { x: 21, y: 8 }]);
  await dragStroke(page, [{ x: 21, y: 8 }, { x: 21, y: 1 }]);

  await setMode(page, "fill");
  await clickTexturePixel(page, 24, 4);

  await expect.poll(
    () => readPixel(page, 24, 4)
  ).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  await expect.poll(
    () => readPixel(page, 32, 4)
  ).toMatchObject({ a: 0 });
});

test("global fill recolors every matching pixel canvas-wide", async({ page }) => {
  await setMode(page, "paint");
  await setBrushColor(page, "primary", "#123456");
  await clickTexturePixel(page, 24, 10);
  await clickTexturePixel(page, 26, 12);

  await setMode(page, "fill");
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Fill", exact: true }).hover();
  await page.getByRole("button", { name: "Global", exact: true }).click();
  await setBrushColor(page, "primary", "#654321");
  await clickTexturePixel(page, 24, 10);

  await expect.poll(
    () => readPixel(page, 24, 10)
  ).toEqual({ r: 0x65, g: 0x43, b: 0x21, a: 255 });
  await expect.poll(
    () => readPixel(page, 26, 12)
  ).toEqual({ r: 0x65, g: 0x43, b: 0x21, a: 255 });
  await expect.poll(
    () => readPixel(page, 25, 11)
  ).toMatchObject({ a: 0 });
});

test("right-click fill uses the secondary color", async({ page }) => {
  test.slow();
  await setMode(page, "paint");
  await dragStroke(page, [{ x: 31, y: 1 }, { x: 34, y: 1 }]);
  await dragStroke(page, [{ x: 34, y: 1 }, { x: 34, y: 4 }]);
  await dragStroke(page, [{ x: 34, y: 4 }, { x: 31, y: 4 }]);
  await dragStroke(page, [{ x: 31, y: 4 }, { x: 31, y: 1 }]);

  await setMode(page, "fill");
  await setBrushColor(page, "secondary", "#ff8800");
  await clickTexturePixel(page, 32, 2, "right");

  await expect.poll(
    () => readPixel(page, 32, 2)
  ).toEqual({ r: 0xff, g: 0x88, b: 0, a: 255 });
  await expect.poll(
    () => readPixel(page, 37, 2)
  ).toMatchObject({ a: 0 });
});

test("Clip to UV keeps a fill inside or outside a UV region", async({ page }) => {
  await addUvRegion(page, { x: 30, y: 10, width: 4, height: 4 });
  await setMode(page, "fill");

  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: "Fill", exact: true }).hover();
  const clipButton = page.getByRole("button", { name: "Clip to UV", exact: true });
  await expect(clipButton).toHaveAttribute("aria-pressed", "false");
  await clipButton.click();
  await expect(clipButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("mode-rail [part=uv-clip-badge]")).toBeVisible();

  await setBrushColor(page, "primary", "#123456");
  await clickTexturePixel(page, 31, 11);
  await expect.poll(
    () => readPixel(page, 33, 13)
  ).toEqual({ r: 0x12, g: 0x34, b: 0x56, a: 255 });
  await expect.poll(
    () => readPixel(page, 29, 11)
  ).toMatchObject({ a: 0 });

  await setBrushColor(page, "primary", "#654321");
  await clickTexturePixel(page, 25, 5);
  await expect.poll(
    () => readPixel(page, 25, 5)
  ).toEqual({ r: 0x65, g: 0x43, b: 0x21, a: 255 });
  await expect.poll(
    () => readPixel(page, 34, 12)
  ).toEqual({ r: 0x65, g: 0x43, b: 0x21, a: 255 });
  await expect.poll(
    () => readPixel(page, 31, 11)
  ).toEqual({ r: 0x12, g: 0x34, b: 0x56, a: 255 });
});

function flyoutWidth(page: Page): Promise<number> {
  return page.evaluate(() => {
    const panel = document.querySelector("pixel-draw-panel");
    const modeRail = panel?.shadowRoot?.querySelector("mode-rail");
    const flyout = modeRail?.shadowRoot?.querySelector('.rail-flyout:has(button[title="Global"])');

    return flyout ? flyout.getBoundingClientRect().width : -1;
  });
}

test("clicking a mode button does not leave its flyout open once the mouse moves away", async({ page }) => {
  const fillButton = page.getByRole("button", { name: "Fill", exact: true });

  await fillButton.hover();
  await expect.poll(() => flyoutWidth(page)).toBeGreaterThan(0);
  await fillButton.click();

  await page.mouse.move(0, 0);
  await expect.poll(() => flyoutWidth(page)).toBe(0);
});
