// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import {
  followGridPreferences,
  type PreferenceGrid
} from "../../src/features/viewport/followGridPreferences.ts";
import { SCENE_PREFERENCES } from "../../src/preferences.ts";

function createGrid(): PreferenceGrid {
  return {
    enabled: true,
    showAxes: true
  };
}

describe("followGridPreferences", () => {
  test("applies the stored grid and axes visibility", () => {
    const grid = createGrid();
    const preferences = new Preferences({
      overrides: [["scene", { grid: false, axes: false }]]
    });

    followGridPreferences(grid, preferences, () => undefined);

    assert.deepEqual(grid, { enabled: false, showAxes: false });
  });

  test("follows later changes until stopped", () => {
    const grid = createGrid();
    const preferences = new Preferences();
    let changes = 0;
    const stop = followGridPreferences(grid, preferences, () => {
      changes++;
    });

    preferences.update(SCENE_PREFERENCES, { axes: false });
    assert.deepEqual(grid, { enabled: true, showAxes: false });

    stop();
    preferences.update(SCENE_PREFERENCES, { grid: false });
    assert.deepEqual(grid, { enabled: true, showAxes: false });
    assert.strictEqual(changes, 1);
  });
});
