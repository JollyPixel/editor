// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  DEFAULT_VIEW_SETTINGS,
  ViewSettingsStore,
  backgroundOf,
  type ViewSettings
} from "#src/state/index.ts";

describe("ViewSettingsStore", () => {
  test("starts from the defaults without stored settings", () => {
    const store = new ViewSettingsStore();

    assert.deepEqual(store.settings, DEFAULT_VIEW_SETTINGS);
  });

  test("emits and remembers an update across instances", () => {
    const storage = new MemoryStorageAdapter();
    const store = new ViewSettingsStore({ storage });
    const emitted: ViewSettings[] = [];
    store.on("change", (settings) => emitted.push(settings));

    store.update({ lighting: "night", keyLight: "top" });

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].lighting, "night");
    assert.deepEqual(
      new ViewSettingsStore({ storage }).settings,
      {
        ...DEFAULT_VIEW_SETTINGS,
        lighting: "night",
        keyLight: "top"
      }
    );
  });

  test("neither persists nor emits a patch that changes nothing", () => {
    const writes: string[] = [];
    const storage = new MemoryStorageAdapter();
    const store = new ViewSettingsStore({
      storage: {
        get: (key) => storage.get(key),
        set: (key, value) => {
          writes.push(value);
          storage.set(key, value);
        }
      }
    });
    let emitted = 0;
    store.on("change", () => emitted++);

    store.update({ keyLight: "top" });
    store.update({ keyLight: "top" });
    store.update({ keyLight: "top", lighting: "studio" });
    store.update({ keyLight: "front-left" });

    assert.equal(writes.length, 2);
    assert.equal(emitted, 2);
  });

  test("follows the settings from now until unsubscribed", () => {
    const store = new ViewSettingsStore();
    const lightings: string[] = [];

    const unfollow = store.follow((settings) => lightings.push(settings.lighting));
    store.update({ lighting: "flat" });
    unfollow();
    store.update({ lighting: "night" });

    assert.deepEqual(lightings, ["studio", "flat"]);
  });

  test("drops unknown or malformed stored values", () => {
    const storage = new MemoryStorageAdapter();
    storage.set("voxel-model:view", JSON.stringify({
      lighting: "dusk",
      background: "red",
      keyLight: "behind",
      reflections: "yes",
      glow: "on",
      shadows: "on",
      exposure: 2
    }));

    const store = new ViewSettingsStore({ storage });

    assert.deepEqual(store.settings, DEFAULT_VIEW_SETTINGS);

    storage.set("voxel-model:view", "{not json");
    assert.deepEqual(new ViewSettingsStore({ storage }).settings, DEFAULT_VIEW_SETTINGS);
  });

  test("shows the lighting's background until a custom colour is picked, then until it is reset", () => {
    const store = new ViewSettingsStore();
    const night = backgroundOf({ lighting: "night", background: null });
    store.update({ lighting: "night" });
    assert.equal(backgroundOf(store.settings), night);

    store.update({ background: "#AA3300" });
    assert.equal(backgroundOf(store.settings), "#aa3300");
    store.update({ lighting: "day" });
    assert.equal(backgroundOf(store.settings), "#aa3300");

    store.update({ background: null });
    assert.notEqual(backgroundOf(store.settings), "#aa3300");
    assert.notEqual(backgroundOf(store.settings), night);
  });
});
