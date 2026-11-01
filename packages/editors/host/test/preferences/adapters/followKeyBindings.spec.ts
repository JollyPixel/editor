// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Preferences,
  defineKeyBindings
} from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { followKeyBindings } from "#src/index.ts";

// CONSTANTS
const kKeys = defineKeyBindings({
  name: "keys",
  label: "Keys",
  defaults: {
    rotate: "r",
    flipHorizontal: "h",
    flipVertical: "v"
  },
  actions: {
    rotate: {
      label: "Rotate"
    },
    flipHorizontal: {
      label: "Flip horizontally"
    },
    flipVertical: {
      label: "Flip vertically"
    }
  }
});

describe("followKeyBindings", () => {
  test("binds the scope defaults until the preferences override them", () => {
    const preferences = new Preferences({
      overrides: [["keys", { rotate: ["e"] }]]
    });
    const settings = followKeyBindings(preferences, kKeys);

    assert.deepEqual(settings.chordsBoundTo("rotate"), ["e"]);
    assert.deepEqual(settings.chordsBoundTo("flipVertical"), ["v"]);
  });

  test("keeps a rebound action in the preferences, overrides only", () => {
    const preferences = new Preferences();
    const settings = followKeyBindings(preferences, kKeys);

    settings.assign("rotate", ["e"]);

    assert.deepEqual(preferences.overrides("keys"), {
      rotate: ["e"]
    });
    assert.deepEqual(
      followKeyBindings(preferences, kKeys).chordsBoundTo("rotate"),
      ["e"]
    );
  });

  test("applies a swap made in the Settings tab", () => {
    const preferences = new Preferences();
    const settings = followKeyBindings(preferences, kKeys);

    preferences.receive("keys", {
      flipHorizontal: ["v"],
      flipVertical: ["h"]
    });

    assert.deepEqual(settings.chordsBoundTo("flipHorizontal"), ["v"]);
    assert.deepEqual(settings.chordsBoundTo("flipVertical"), ["h"]);
  });

  test("reports and writes back a stored chord it cannot read", () => {
    const preferences = new Preferences({
      overrides: [["keys", { rotate: ["not a chord"] }]]
    });
    const dropped: string[] = [];
    const settings = followKeyBindings(
      preferences,
      kKeys,
      (message) => dropped.push(message)
    );

    assert.equal(dropped.length, 1);
    assert.deepEqual(settings.chordsBoundTo("rotate"), ["r"]);
    assert.deepEqual(preferences.overrides("keys"), {});
  });
});
