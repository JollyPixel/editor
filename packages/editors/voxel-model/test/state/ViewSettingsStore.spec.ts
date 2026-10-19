// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Preferences,
  type PreferenceChange
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import {
  ViewSettingsStore,
  resolveBackground,
  type ViewSettings
} from "#src/state/index.ts";

describe("ViewSettingsStore", () => {
  test("starts from the defaults without stored settings", () => {
    const store = new ViewSettingsStore(new Preferences());

    assert.deepEqual(store.settings, {
      lighting: "studio",
      keyLight: "front-right",
      background: null,
      reflections: true,
      shadows: false,
      glow: true
    });
  });

  test("writes an update to the preferences and emits it once", () => {
    const preferences = new Preferences();
    const store = new ViewSettingsStore(preferences);
    const emitted: ViewSettings[] = [];
    store.on("change", (settings) => emitted.push(settings));

    store.update({ lighting: "night", keyLight: "top" });

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].lighting, "night");
    assert.deepEqual(preferences.overrides("voxel-model"), {
      lighting: "night",
      keyLight: "top"
    });
  });

  test("neither writes nor emits a patch that changes nothing", () => {
    const writes: PreferenceChange[] = [];
    const store = new ViewSettingsStore(new Preferences({
      write: (change) => writes.push(change)
    }));
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
    const preferences = new Preferences();
    const store = new ViewSettingsStore(preferences);
    const lightings: string[] = [];

    const unfollow = store.follow((settings) => lightings.push(settings.lighting));
    store.update({ lighting: "flat" });
    preferences.receive("voxel-model", { lighting: "day" });
    unfollow();
    store.update({ lighting: "night" });

    assert.deepEqual(lightings, ["studio", "flat", "day"]);
  });

  test("shows the lighting's background until a custom colour is picked, then until it is reset", () => {
    const store = new ViewSettingsStore(new Preferences());
    const night = resolveBackground({ lighting: "night", background: null });
    store.update({ lighting: "night" });
    assert.equal(resolveBackground(store.settings), night);

    store.update({ background: "#AA3300" });
    assert.equal(resolveBackground(store.settings), "#aa3300");
    store.update({ lighting: "day" });
    assert.equal(resolveBackground(store.settings), "#aa3300");

    store.update({ background: null });
    assert.notEqual(resolveBackground(store.settings), "#aa3300");
    assert.notEqual(resolveBackground(store.settings), night);
  });
});
