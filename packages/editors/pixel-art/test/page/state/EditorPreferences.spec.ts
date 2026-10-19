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
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  EditorPreferences,
  MODE_STORAGE_KEY
} from "../../../page/src/state/EditorPreferences.ts";

function createCanvas() {
  return {
    uv: new UVMap({
      getCanvasSize: () => {
        return { x: 16, y: 16 };
      }
    }),
    grid: new TextureGrid()
  };
}

describe("EditorPreferences", () => {
  test("shows the canvas as the preferences say and restores the mode from the browser", () => {
    const storage = new MemoryStorageAdapter();
    storage.set(MODE_STORAGE_KEY, "uv");
    const preferences = new EditorPreferences(storage, new Preferences({
      overrides: [["pixel-art", { showSizeLabels: true, showGrid: true }]]
    }));
    const canvas = createCanvas();

    preferences.activate(canvas);

    assert.equal(preferences.mode, "uv");
    assert.deepEqual(
      [canvas.uv.showAll, canvas.uv.showSizeLabels, canvas.grid.visible, canvas.grid.size],
      [false, true, true, 16]
    );
  });

  test("an unknown stored mode falls back to paint", () => {
    const storage = new MemoryStorageAdapter();
    storage.set(MODE_STORAGE_KEY, "unknown");

    assert.equal(new EditorPreferences(storage, new Preferences()).mode, "paint");
  });

  test("grid changes on the active canvas are restored on the next canvas", () => {
    const storage = new MemoryStorageAdapter();
    const preferences = new Preferences();
    const first = createCanvas();
    new EditorPreferences(storage, preferences).activate(first);

    first.grid.visible = true;
    first.grid.snap = true;
    first.grid.size = 32;
    const next = createCanvas();
    new EditorPreferences(storage, preferences).activate(next);

    assert.deepEqual(
      [next.grid.visible, next.grid.snap, next.grid.size],
      [true, true, 32]
    );
  });

  test("follows a change made in the Settings tab without writing it back", () => {
    const preferences = new Preferences();
    const canvas = createCanvas();
    new EditorPreferences(new MemoryStorageAdapter(), preferences)
      .activate(canvas);

    preferences.receive("pixel-art", { showGrid: true, gridSize: 8 });

    assert.deepEqual([canvas.grid.visible, canvas.grid.size], [true, 8]);
    assert.deepEqual(preferences.overrides("pixel-art"), {
      showGrid: true,
      gridSize: 8
    });
  });
});
