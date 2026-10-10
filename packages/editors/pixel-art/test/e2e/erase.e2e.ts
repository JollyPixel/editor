// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR
} from "./support/canvas.ts";

test.beforeEach(async({ panel }) => {
  await panel.canvas.seed([
    {
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      color: "#000000"
    }
  ]);
  await panel.modes.select("erase");
});

test("both mouse buttons erase to transparency", async({ panel }) => {
  await panel.canvas.drag([
    { x: 2, y: 2 },
    { x: 2, y: 4 }
  ]);
  await panel.canvas.click({ x: 6, y: 6 }, "right");

  await expect.poll(() => panel.canvas.pixels([
    { x: 2, y: 2 },
    { x: 2, y: 4 },
    { x: 6, y: 6 },
    { x: 3, y: 2 }
  ])).toEqual([CLEAR, CLEAR, CLEAR, BLACK]);
});

test("the eraser uses the brush size slider", async({ panel }) => {
  await panel.modes.resizeBrush(4);
  await panel.canvas.click({ x: 12, y: 12 });

  await expect.poll(() => panel.canvas.pixels([
    { x: 10, y: 10 },
    { x: 13, y: 13 },
    { x: 9, y: 9 },
    { x: 14, y: 14 }
  ])).toEqual([CLEAR, CLEAR, BLACK, BLACK]);
});
