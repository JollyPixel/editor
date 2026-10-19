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
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { EditorPreferences } from "../../../page/src/state/EditorPreferences.ts";

// CONSTANTS
const kStorageKey = "pixel-art:preferences";

function restore(
  raw: string
) {
  const storage = new MemoryStorageAdapter();
  storage.set(kStorageKey, raw);
  const preferences = new EditorPreferences(storage);
  const uv = new UVMap({
    getCanvasSize: () => {
      return { x: 16, y: 16 };
    }
  });
  const grid = new TextureGrid();
  preferences.activate({ uv, grid });

  return {
    mode: preferences.mode,
    showAll: uv.showAll,
    showRegionLabels: uv.showRegionLabels,
    showSizeLabels: uv.showSizeLabels,
    grid: {
      visible: grid.visible,
      snap: grid.snap,
      size: grid.size
    }
  };
}

const kDefaultGrid = {
  visible: false,
  snap: false,
  size: 16
};

describe("EditorPreferences", () => {
  test("an unreadable stored value falls back to every default", () => {
    assert.deepEqual(restore("{broken"), {
      mode: "paint",
      showAll: false,
      showRegionLabels: false,
      showSizeLabels: false,
      grid: kDefaultGrid
    });
  });

  test("an invalid field falls back alone while valid fields survive", () => {
    assert.deepEqual(restore(JSON.stringify({
      mode: "unknown",
      showAll: "true",
      showSizeLabels: true,
      showGrid: true,
      gridSize: 0
    })), {
      mode: "paint",
      showAll: false,
      showRegionLabels: false,
      showSizeLabels: true,
      grid: {
        ...kDefaultGrid,
        visible: true
      }
    });
    assert.deepEqual(restore(JSON.stringify({
      mode: "uv",
      showRegionLabels: "true"
    })), {
      mode: "uv",
      showAll: false,
      showRegionLabels: false,
      showSizeLabels: false,
      grid: kDefaultGrid
    });
  });

  test("grid changes on the active canvas are restored on the next canvas", () => {
    const storage = new MemoryStorageAdapter();
    const uv = new UVMap({
      getCanvasSize: () => {
        return { x: 16, y: 16 };
      }
    });
    const first = new TextureGrid();
    new EditorPreferences(storage).activate({ uv, grid: first });

    first.visible = true;
    first.snap = true;
    first.size = 32;
    const next = new TextureGrid();
    new EditorPreferences(storage).activate({ uv, grid: next });

    assert.deepEqual(
      [next.visible, next.snap, next.size],
      [true, true, 32]
    );
  });
});
