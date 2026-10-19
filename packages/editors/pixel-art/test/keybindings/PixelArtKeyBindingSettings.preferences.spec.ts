// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { PixelArtKeyBindingSettings } from "#src/keybindings/PixelArtKeyBindingSettings.ts";

describe("PixelArtKeyBindingSettings.follow", () => {
  test("keeps a rebound action in the preferences, overrides only", () => {
    const preferences = new Preferences();
    const settings = PixelArtKeyBindingSettings.follow(preferences);

    settings.assign("rotate", ["e"]);

    assert.deepEqual(preferences.overrides("pixel-art-keybindings"), {
      rotate: ["e"]
    });
    assert.deepEqual(
      PixelArtKeyBindingSettings.follow(preferences).chordsBoundTo("rotate"),
      ["e"]
    );
  });

  test("applies a swap made in the Settings tab", () => {
    const preferences = new Preferences();
    const settings = PixelArtKeyBindingSettings.follow(preferences);

    preferences.receive("pixel-art-keybindings", {
      flipHorizontal: ["v"],
      flipVertical: ["h"]
    });

    assert.deepEqual(settings.chordsBoundTo("flipHorizontal"), ["v"]);
    assert.deepEqual(settings.chordsBoundTo("flipVertical"), ["h"]);
  });
});
