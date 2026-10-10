// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR,
  type PixelRect
} from "./support/canvas.ts";

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
  await panel.modes.select("fill");
});

test("contiguous fill stays inside a boundary, right-click uses the secondary color", async({ panel }) => {
  await panel.canvas.seed([
    ...outline(0, 0, 8),
    ...outline(20, 0, 5)
  ]);
  await panel.colors.assign("secondary", "#ff8800");

  await panel.canvas.click({ x: 3, y: 3 });
  await panel.canvas.click({ x: 22, y: 2 }, "right");

  await expect.poll(() => panel.canvas.pixels([
    { x: 3, y: 3 },
    { x: 10, y: 3 },
    { x: 22, y: 2 },
    { x: 26, y: 2 }
  ])).toEqual([BLACK, CLEAR, "#ff8800ff", CLEAR]);
});

test("global fill recolors every matching pixel canvas-wide", async({ panel }) => {
  await panel.canvas.seed([
    { x: 4, y: 10, color: "#123456" },
    { x: 60, y: 70, color: "#123456" }
  ]);
  await panel.modes.pick("fill", "Global");
  await panel.colors.assign("primary", "#654321");

  await panel.canvas.click({ x: 4, y: 10 });

  await expect.poll(() => panel.canvas.pixels([
    { x: 4, y: 10 },
    { x: 60, y: 70 },
    { x: 5, y: 10 }
  ])).toEqual(["#654321ff", "#654321ff", CLEAR]);
});

test("Clip to UV keeps a fill inside or outside a UV region", async({ panel }) => {
  await panel.uv.addRegion({ x: 30, y: 10, width: 4, height: 4 });

  await panel.modes.pick("fill", "Clip to UV");
  await expect(panel.modes.option("Clip to UV")).toHaveAttribute("aria-pressed", "true");
  await expect(panel.modes.clipBadge).toBeVisible();

  await panel.colors.assign("primary", "#123456");
  await panel.canvas.click({ x: 31, y: 11 });
  await expect.poll(() => panel.canvas.pixels([
    { x: 33, y: 13 },
    { x: 29, y: 11 }
  ])).toEqual(["#123456ff", CLEAR]);

  await panel.colors.assign("primary", "#654321");
  await panel.canvas.click({ x: 25, y: 5 });
  await expect.poll(() => panel.canvas.pixels([
    { x: 25, y: 5 },
    { x: 34, y: 12 },
    { x: 31, y: 11 }
  ])).toEqual(["#654321ff", "#654321ff", "#123456ff"]);
});

test("a mode flyout closes once the pointer leaves, even after a click", async({ panel, page }) => {
  const flyout = panel.modes.flyout("Global");

  await page.mouse.move(0, 0);
  await panel.modes.button("fill").hover();
  await expect(flyout).toBeVisible();
  await panel.modes.button("fill").click();
  await page.mouse.move(0, 0);

  await expect(flyout).toBeHidden();
});
