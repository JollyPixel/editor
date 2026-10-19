// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  TextureGrid,
  UVMap
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  ViewSettings,
  type ViewCanvas,
  type ViewSettingsInit
} from "../../src/panel/ViewSettings.ts";

// CONSTANTS
const kInit: ViewSettingsInit = {
  showAll: true,
  showRegionLabels: true,
  showSizeLabels: true,
  showGrid: true,
  snapToGrid: true
};

function makeViewCanvas(
  gridSize: number
): ViewCanvas {
  return {
    uv: new UVMap({
      getCanvasSize: () => {
        return { x: 16, y: 16 };
      }
    }),
    grid: new TextureGrid({ size: gridSize })
  };
}

describe("UI.ViewSettings", () => {
  test("round-trips every view option between two canvases and keeps each cell size", () => {
    const source = makeViewCanvas(8);
    const target = makeViewCanvas(32);
    new ViewSettings(kInit).applyTo(source);

    ViewSettings.capture(source).applyTo(target);

    assert.deepEqual({ ...ViewSettings.capture(target) }, kInit);
    assert.equal(target.grid.size, 32);
  });
});
