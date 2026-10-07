// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { ViewStore } from "../../src/state/ViewStore.ts";
import {
  ViewSettings,
  type ViewSettingsJSON
} from "../../src/state/ViewSettings.ts";

// CONSTANTS
const kKey = "voxel-map:view";

describe("ViewStore", () => {
  test("starts from the defaults with every effect off but block light and glow", () => {
    const store = new ViewStore();

    assert.deepEqual(store.settings, ViewSettings.DEFAULT);
    assert.deepEqual(store.settings.toJSON(), {
      lighting: "studio",
      reflections: false,
      ambientOcclusion: false,
      shadows: false,
      blockLight: true,
      glow: true
    });
  });

  test("persists an update and emits the new settings once", () => {
    const storage = new MemoryStorageAdapter();
    const store = new ViewStore(storage);
    const seen: ViewSettingsJSON[] = [];
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

    assert.deepEqual(
      new ViewStore(storage).settings,
      ViewSettings.DEFAULT.with({ ambientOcclusion: true })
    );

    storage.set(kKey, "{not json");
    assert.deepEqual(new ViewStore(storage).settings, ViewSettings.DEFAULT);
  });

  test("ignores an invalid lighting mode in an update", () => {
    const store = new ViewStore();
    store.update({ lighting: "daylight" });

    store.update(JSON.parse("{\"lighting\":\"dusk\"}"));

    assert.equal(store.settings.lighting, "daylight");
  });

  test("restores the night lighting mode from storage", () => {
    const storage = new MemoryStorageAdapter();
    new ViewStore(storage).update({ lighting: "night" });

    assert.equal(new ViewStore(storage).settings.lighting, "night");
  });
});

describe("ViewSettings", () => {
  test("parses stored JSON and falls back field by field", () => {
    assert.equal(ViewSettings.parse(null), ViewSettings.DEFAULT);
    assert.equal(ViewSettings.parse("{not json"), ViewSettings.DEFAULT);
    assert.deepEqual(
      ViewSettings.parse("{\"lighting\":\"flat\",\"shadows\":1}").toJSON(),
      {
        ...ViewSettings.DEFAULT.toJSON(),
        lighting: "flat"
      }
    );
  });

  test("changes into new settings and compares by value", () => {
    const shaded = ViewSettings.DEFAULT.with({ shadows: true });

    assert.equal(ViewSettings.DEFAULT.shadows, false);
    assert.equal(shaded.equals(ViewSettings.DEFAULT.with({ shadows: true })), true);
    assert.equal(shaded.equals(ViewSettings.DEFAULT), false);
  });
});
