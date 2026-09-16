// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR,
  addUvRegion,
  clickTexturePixel,
  clickToolOption,
  readPixels,
  seedTexture,
  setBrushColor,
  setMode,
  type PixelRect
} from "./utils.ts";

function outline(
  x: number,
  y: number,
  size: number
): PixelRect[] {
  const color = "#000000";

  return [
    { x, y, width: size, color },
    { x, y: y + size - 1, width: size, color },
    { x, y, height: size, color },
    { x: x + size - 1, y, height: size, color }
  ];
}

test.beforeEach(async({ panel }) => {
  await setMode(panel, "fill");
});

test("contiguous fill stays inside a boundary, right-click uses the secondary color", async({ panel }) => {
  await seedTexture(panel, [
    ...outline(0, 0, 8),
    ...outline(20, 0, 5)
  ]);
  await setBrushColor(panel, "secondary", "#ff8800");

  await clickTexturePixel(panel, { x: 3, y: 3 });
  await clickTexturePixel(panel, { x: 22, y: 2 }, "right");

  await expect.poll(() => readPixels(panel, [
    { x: 3, y: 3 },
    { x: 10, y: 3 },
    { x: 22, y: 2 },
    { x: 26, y: 2 }
  ])).toEqual([BLACK, CLEAR, "#ff8800ff", CLEAR]);
});

test("global fill recolors every matching pixel canvas-wide", async({ panel }) => {
  await seedTexture(panel, [
    { x: 4, y: 10, color: "#123456" },
    { x: 60, y: 70, color: "#123456" }
  ]);
  await clickToolOption(panel, "fill", "Global");
  await setBrushColor(panel, "primary", "#654321");

  await clickTexturePixel(panel, { x: 4, y: 10 });

  await expect.poll(() => readPixels(panel, [
    { x: 4, y: 10 },
    { x: 60, y: 70 },
    { x: 5, y: 10 }
  ])).toEqual(["#654321ff", "#654321ff", CLEAR]);
});

test("Clip to UV keeps a fill inside or outside a UV region", async({ panel }) => {
  await addUvRegion(panel, { x: 30, y: 10, width: 4, height: 4 });
  const clip = panel.getByRole("button", { name: "Clip to UV", exact: true });

  await clickToolOption(panel, "fill", "Clip to UV");
  await expect(clip).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator("mode-rail [part=uv-clip-badge]")).toBeVisible();

  await setBrushColor(panel, "primary", "#123456");
  await clickTexturePixel(panel, { x: 31, y: 11 });
  await expect.poll(() => readPixels(panel, [
    { x: 33, y: 13 },
    { x: 29, y: 11 }
  ])).toEqual(["#123456ff", CLEAR]);

  await setBrushColor(panel, "primary", "#654321");
  await clickTexturePixel(panel, { x: 25, y: 5 });
  await expect.poll(() => readPixels(panel, [
    { x: 25, y: 5 },
    { x: 34, y: 12 },
    { x: 31, y: 11 }
  ])).toEqual(["#654321ff", "#654321ff", "#123456ff"]);
});

test("a mode flyout closes once the pointer leaves, even after a click", async({ panel, page }) => {
  const fill = panel.getByRole("button", { name: "Fill", exact: true });
  const flyout = panel.locator("mode-rail .rail-flyout").filter({
    has: page.getByRole("button", { name: "Global", exact: true })
  });

  await page.mouse.move(0, 0);
  await fill.hover();
  await expect(flyout).toBeVisible();
  await fill.click();
  await page.mouse.move(0, 0);

  await expect(flyout).toBeHidden();
});
