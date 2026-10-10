// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR
} from "./support/canvas.ts";
import type { PixelDrawPanel } from "../../src/index.ts";

test.beforeEach(async({ panel }) => {
  await panel.modes.select("paint");
});

test("draws a freehand stroke in the primary color", async({ panel }) => {
  await panel.canvas.drag([
    { x: 2, y: 2 },
    { x: 2, y: 4 }
  ]);

  await expect.poll(() => panel.canvas.pixels([
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 2, y: 4 },
    { x: 3, y: 2 }
  ])).toEqual([BLACK, BLACK, BLACK, CLEAR]);
});

test("right-click drags a stroke in the secondary color", async({ panel }) => {
  await panel.colors.assign("secondary", "#0000ff");

  await panel.canvas.drag([
    { x: 11, y: 2 },
    { x: 11, y: 4 }
  ], { button: "right" });

  await expect.poll(() => panel.canvas.pixels([
    { x: 11, y: 2 },
    { x: 11, y: 4 },
    { x: 12, y: 2 }
  ])).toEqual(["#0000ffff", "#0000ffff", CLEAR]);
});

test("Shift-click draws a straight line from the hovered point", async({ panel, page }) => {
  await panel.canvas.hover({ x: 2, y: 10 });
  await page.keyboard.down("Shift");
  await panel.canvas.click({ x: 8, y: 10 });
  await page.keyboard.up("Shift");

  const line = Array.from({ length: 7 }, (_, index) => {
    return { x: 2 + index, y: 10 };
  });
  await expect.poll(() => panel.canvas.pixels(line))
    .toEqual(line.map(() => BLACK));
});

test("the size slider widens the brush footprint", async({ panel }) => {
  await panel.modes.resizeBrush(4);

  await panel.canvas.click({ x: 6, y: 6 });

  await expect.poll(() => panel.canvas.pixels([
    { x: 4, y: 4 },
    { x: 7, y: 7 },
    { x: 3, y: 3 },
    { x: 8, y: 8 }
  ])).toEqual([BLACK, BLACK, CLEAR, CLEAR]);
});

test("Ctrl+wheel adjusts the brush size and its overlay label", async({ panel, page }) => {
  function brushSize() {
    return panel.root.evaluate(
      (element: PixelDrawPanel) => element.canvasManager!.brush.size
    );
  }
  const before = await brushSize();

  await panel.canvas.hover({ x: 40, y: 40 });
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");

  await expect.poll(brushSize).toBe(before + 1);
  await expect(panel.root.getByText(`${before + 1}px`)).toBeVisible();
});
