// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { UVMap } from "@jolly-pixel/pixel-draw.renderer";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { EditorPreferences } from "../../page/scripts/EditorPreferences.ts";

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
  preferences.activate({ uv });

  return {
    mode: preferences.mode,
    showAll: uv.showAll,
    showRegionLabels: uv.showRegionLabels,
    showSizeLabels: uv.showSizeLabels
  };
}

describe("EditorPreferences", () => {
  test("an unreadable stored value falls back to every default", () => {
    assert.deepEqual(restore("{broken"), {
      mode: "paint",
      showAll: false,
      showRegionLabels: false,
      showSizeLabels: false
    });
  });

  test("an invalid field falls back alone while valid fields survive", () => {
    assert.deepEqual(restore(JSON.stringify({
      mode: "unknown",
      showAll: "true",
      showSizeLabels: true
    })), {
      mode: "paint",
      showAll: false,
      showRegionLabels: false,
      showSizeLabels: true
    });
    assert.deepEqual(restore(JSON.stringify({
      mode: "uv",
      showRegionLabels: "true"
    })), {
      mode: "uv",
      showAll: false,
      showRegionLabels: false,
      showSizeLabels: false
    });
  });
});
