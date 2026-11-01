// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/preferences";
import type { ColorPickerPreferenceSource } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { COLOR_PICKER_PREFERENCES } from "#src/index.ts";
import {
  followColorPickerPreferences
} from "#src/preferences/adapters/followColorPickerPreferences.ts";

function followed(
  preferences: Preferences
): ColorPickerPreferenceSource {
  const sources: ColorPickerPreferenceSource[] = [];
  followColorPickerPreferences(
    {
      follow: (source) => {
        sources.push(source);

        return () => undefined;
      }
    },
    preferences
  );
  const [source] = sources;
  assert.ok(source);

  return source;
}

describe("followColorPickerPreferences", () => {
  test("hands the pickers the stored values and reports each change until unwatched", () => {
    const preferences = new Preferences({
      overrides: [["color-picker", { space: "okhsv", selector: "wheel" }]]
    });
    const source = followed(preferences);
    let changes = 0;

    assert.deepEqual(source.values(), {
      space: "okhsv",
      selector: "wheel",
      channels: "hsl",
      harmony: "none",
      discrete: false
    });

    const unwatch = source.watch(() => changes++);
    preferences.assign(COLOR_PICKER_PREFERENCES, "harmony", "triadic");
    unwatch();
    preferences.assign(COLOR_PICKER_PREFERENCES, "discrete", true);

    assert.equal(changes, 1);
    assert.equal(source.values().harmony, "triadic");
  });

  test("saves what a picker's settings change, back to the default too", () => {
    const preferences = new Preferences();
    const source = followed(preferences);

    source.update({ selector: "wheel" });
    source.update({ harmony: "square" });
    assert.deepEqual(preferences.overrides("color-picker"), {
      selector: "wheel",
      harmony: "square"
    });

    source.update({ harmony: "none" });
    assert.deepEqual(preferences.overrides("color-picker"), { selector: "wheel" });
  });
});
