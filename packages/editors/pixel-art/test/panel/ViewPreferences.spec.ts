// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/editor.host/preferences";
import {
  TextureGrid,
  UVMap
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { ViewPreferences } from "../../src/panel/ViewPreferences.ts";
import type { ViewCanvas } from "../../src/panel/ViewSettings.ts";

function makeViewCanvas(
  gridSize: number
): ViewCanvas {
  return {
    uv: new UVMap({
      getCanvasSize: () => {
        return { x: 64, y: 64 };
      }
    }),
    grid: new TextureGrid({ size: gridSize })
  };
}

describe("ViewPreferences", () => {
  test("a grid shown on the canvas is shown on the next canvas and the grid size is left to the host", () => {
    const preferences = new Preferences();
    const canvas = makeViewCanvas(32);
    new ViewPreferences(preferences).follow(canvas);

    canvas.grid.visible = true;
    const next = makeViewCanvas(8);
    new ViewPreferences(preferences).follow(next);

    assert.deepEqual([next.grid.visible, next.grid.size], [true, 8]);
    assert.deepEqual(preferences.overrides("pixel-art"), { showGrid: true });
  });
});
