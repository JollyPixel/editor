// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { Vec2 } from "#src/types.ts";
import {
  canvasPixels,
  readPixel
} from "./fixtures/canvas.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  createUvCanvas,
  drag
} from "./helpers/uv/canvas.ts";

// CONSTANTS
const kBlack = [0, 0, 0, 255];
const kRed = [255, 0, 0, 255];
const kWhite = [255, 255, 255, 255];

function lineOffsetPixel(
  manager: PixelArtCanvas,
  lineX: number,
  offsetY: number
): number[] {
  const canvas = manager.canvas();
  const { camera, zoom } = manager.viewport;

  return readPixel(
    canvasPixels(canvas),
    {
      x: Math.round(camera.x + (lineX * zoom.value)),
      y: Math.round(camera.y) + offsetY
    },
    canvas.width
  );
}

function screenPixel(
  manager: PixelArtCanvas,
  texel: Vec2
): number[] {
  const canvas = manager.canvas();
  const screen = manager.viewport.toScreen(texel);

  return readPixel(
    canvasPixels(canvas),
    {
      x: Math.round(screen.x),
      y: Math.round(screen.y)
    },
    canvas.width
  );
}

describe("PixelArtCanvas grid", () => {
  test("draws each cell boundary in its color, dashed with the contrasting color", () => {
    const { manager } = createPixelArtCanvas({
      texture: {
        defaultColor: "#000000"
      },
      zoom: { default: 4 },
      grid: {
        size: 4,
        color: "#ff0000"
      }
    });
    assert.deepEqual(lineOffsetPixel(manager, 4, 4), kBlack);

    manager.grid.visible = true;

    assert.deepEqual(lineOffsetPixel(manager, 4, 1), kWhite);
    assert.deepEqual(lineOffsetPixel(manager, 4, 4), kRed);
    assert.deepEqual(screenPixel(manager, { x: 2.5, y: 1.5 }), kBlack);
    manager.destroy();
  });

  test("hides lines once a cell is smaller than four screen pixels", () => {
    const { manager } = createPixelArtCanvas({
      texture: {
        defaultColor: "#000000"
      },
      zoom: { default: 1 },
      grid: {
        size: 2,
        visible: true,
        color: "#ff0000"
      }
    });

    assert.deepEqual(screenPixel(manager, { x: 2, y: 1 }), kBlack);
    manager.destroy();
  });

  test("holding the snap bypass shortcut moves a UV region off the grid", () => {
    const manager = createUvCanvas({
      grid: {
        size: 8,
        snap: true
      }
    });
    manager.mode = "uv";
    const region = manager.uv.create({ width: 2, height: 2 });
    manager.uv.select(region.id);
    const from = manager.viewport.toScreen({ x: 1, y: 1 });
    const to = manager.viewport.toScreen({ x: 3, y: 1 });

    drag(manager, from, to);
    assert.deepEqual(manager.uv.get(region.id)!.bounds, region.bounds);

    manager.shortcuts.snapBypassHeld = true;
    drag(manager, from, to);

    assert.deepEqual(
      manager.uv.get(region.id)!.bounds,
      { x: 2, y: 0, width: 2, height: 2 }
    );
    manager.destroy();
  });
});
