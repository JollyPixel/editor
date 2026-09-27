// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  DEFAULT_VIEW_SETTINGS,
  ViewSettingsStore,
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

    store.update({ shading: "flat", keyLight: "top" });

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].shading, "flat");
    assert.deepEqual(
      new ViewSettingsStore({ storage }).settings,
      {
        ...DEFAULT_VIEW_SETTINGS,
        shading: "flat",
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

    store.update({ exposure: 2 });
    store.update({ exposure: 2 });
    store.update({ exposure: 9, shading: "lit" });
    store.update({ exposure: 3 });

    assert.equal(writes.length, 2);
    assert.equal(emitted, 2);
  });

  test("follows the settings from now until unsubscribed", () => {
    const store = new ViewSettingsStore();
    const shadings: string[] = [];

    const unfollow = store.follow((settings) => shadings.push(settings.shading));
    store.update({ shading: "flat" });
    unfollow();
    store.update({ shading: "lit" });

    assert.deepEqual(shadings, ["lit", "flat"]);
  });

  test("clamps numbers and drops unknown or malformed stored values", () => {
    const storage = new MemoryStorageAdapter();
    storage.set("voxel-model:view", JSON.stringify({
      shading: "wireframe",
      environment: "yes",
      environmentIntensity: 9,
      exposure: -1,
      glow: "on",
      glowStrength: 7
    }));

    const store = new ViewSettingsStore({ storage });

    assert.equal(store.settings.shading, "lit");
    assert.equal(store.settings.environment, true);
    assert.equal(store.settings.environmentIntensity, 2);
    assert.equal(store.settings.exposure, 0.25);
    assert.equal(store.settings.glow, true);
    assert.equal(store.settings.glowStrength, 3);

    storage.set("voxel-model:view", "{not json");
    assert.deepEqual(new ViewSettingsStore({ storage }).settings, DEFAULT_VIEW_SETTINGS);
  });
});
