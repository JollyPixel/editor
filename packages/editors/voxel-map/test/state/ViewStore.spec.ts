// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { ViewStore } from "../../src/state/ViewStore.ts";
import {
  ViewSettings,
  type ViewSettingsJSON
} from "../../src/state/ViewSettings.ts";

describe("ViewStore", () => {
  test("starts from the defaults with every effect off but block light, glow and grid", () => {
    const store = new ViewStore(new Preferences());

    assert.deepEqual(store.settings, ViewSettings.DEFAULT);
    assert.deepEqual(store.settings.toJSON(), {
      lighting: "studio",
      reflections: false,
      ambientOcclusion: false,
      shadows: false,
      blockLight: true,
      glow: true,
      grid: true,
      inspector: "off",
      chunkBounds: false
    });
  });

  test("writes an update to the preferences and emits the new settings once", () => {
    const preferences = new Preferences();
    const store = new ViewStore(preferences);
    const seen: ViewSettingsJSON[] = [];
    store.on("change", (settings) => seen.push({ ...settings }));

    store.update({ reflections: true });
    store.update({ reflections: true });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].reflections, true);
    assert.deepEqual(preferences.overrides("voxel-map"), {
      reflections: true
    });
  });

  test("follows preferences changed elsewhere, such as the Settings tab", () => {
    const preferences = new Preferences();
    const store = new ViewStore(preferences);
    const seen: string[] = [];
    store.on("change", (settings) => seen.push(settings.lighting));

    preferences.receive("voxel-map", { lighting: "night", uvSync: "live" });
    preferences.receive("voxel-map", { lighting: "night" });

    assert.deepEqual(seen, ["night"]);
    assert.equal(store.settings.lighting, "night");
  });
});

describe("ViewSettings", () => {
  test("compares by value", () => {
    const shaded = new ViewSettings({
      ...ViewSettings.DEFAULT.toJSON(),
      shadows: true
    });

    assert.equal(shaded.equals(ViewSettings.DEFAULT), false);
    assert.equal(shaded.equals(new ViewSettings(shaded.toJSON())), true);
  });
});
