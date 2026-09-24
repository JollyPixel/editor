// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  DEFAULT_VIEW_SETTINGS,
  ViewStore,
  type ViewSettings
} from "../../src/state/ViewStore.ts";

// CONSTANTS
const kKey = "voxel-map:view";

describe("ViewStore", () => {
  test("starts from the defaults with every effect off", () => {
    const store = new ViewStore();

    assert.deepEqual(store.settings, DEFAULT_VIEW_SETTINGS);
    assert.deepEqual(store.settings, {
      lighting: "studio",
      reflections: false,
      ambientOcclusion: false,
      shadows: false
    });
  });

  test("persists an update and emits the new settings once", () => {
    const storage = new MemoryStorageAdapter();
    const store = new ViewStore(storage);
    const seen: ViewSettings[] = [];
    store.on("change", (settings) => seen.push({ ...settings }));

    store.update({ reflections: true });
    store.update({ reflections: true });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].reflections, true);
    assert.equal(new ViewStore(storage).settings.reflections, true);
  });

  test("falls back to the defaults for invalid stored values", () => {
    const storage = new MemoryStorageAdapter();
    storage.set(kKey, JSON.stringify({
      lighting: "sunset",
      shadows: "yes",
      ambientOcclusion: true
    }));

    assert.deepEqual(new ViewStore(storage).settings, {
      ...DEFAULT_VIEW_SETTINGS,
      ambientOcclusion: true
    });

    storage.set(kKey, "{not json");
    assert.deepEqual(new ViewStore(storage).settings, DEFAULT_VIEW_SETTINGS);
  });

  test("ignores an invalid lighting mode in an update", () => {
    const store = new ViewStore();
    store.update({ lighting: "daylight" });

    store.update(JSON.parse("{\"lighting\":\"night\"}"));

    assert.equal(store.settings.lighting, "daylight");
  });
});
