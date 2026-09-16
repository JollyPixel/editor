// Import Internal Dependencies
import { test, expect } from "./fixtures.ts";
import {
  BLACK,
  CLEAR,
  clickTexturePixel,
  dragStroke,
  readPixels,
  seedTexture,
  setBrushSize,
  setMode
} from "./utils.ts";

test.beforeEach(async({ panel }) => {
  await seedTexture(panel, [
    {
      x: 0,
      y: 0,
      width: 20,
      height: 20,
      color: "#000000"
    }
  ]);
  await setMode(panel, "erase");
});

test("both mouse buttons erase to transparency", async({ panel }) => {
  await dragStroke(panel, [
    { x: 2, y: 2 },
    { x: 2, y: 4 }
  ]);
  await clickTexturePixel(panel, { x: 6, y: 6 }, "right");

  await expect.poll(() => readPixels(panel, [
    { x: 2, y: 2 },
    { x: 2, y: 4 },
    { x: 6, y: 6 },
    { x: 3, y: 2 }
  ])).toEqual([CLEAR, CLEAR, CLEAR, BLACK]);
});

test("the eraser uses the brush size slider", async({ panel }) => {
  await setBrushSize(panel, 4);
  await clickTexturePixel(panel, { x: 12, y: 12 });

  await expect.poll(() => readPixels(panel, [
    { x: 10, y: 10 },
    { x: 13, y: 13 },
    { x: 9, y: 9 },
    { x: 14, y: 14 }
  ])).toEqual([CLEAR, CLEAR, BLACK, BLACK]);
});
