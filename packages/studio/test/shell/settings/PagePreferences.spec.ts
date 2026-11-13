// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  definePreferences,
  Preferences
} from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { PagePreferences } from "../../../src/shell/settings/PagePreferences.ts";

// CONSTANTS
const kGrid = definePreferences({
  name: "grid",
  label: "Grid",
  fields: {
    visible: {
      type: "boolean",
      label: "Visible",
      default: false
    }
  }
});
const kKeys = definePreferences({
  name: "grid-keybindings",
  label: "Grid",
  fields: {
    toggle: {
      type: "chord",
      label: "Toggle",
      default: ["g"]
    }
  }
});

describe("PagePreferences", () => {
  test("resets every scope of the page, shortcuts included, and leaves the others", () => {
    const preferences = new Preferences({
      overrides: [
        ["grid", { visible: true }],
        ["grid-keybindings", { toggle: ["h"] }],
        ["theme", { dark: true }]
      ]
    });
    const page = new PagePreferences(preferences, [kGrid, kKeys]);
    assert.equal(page.customized, true);

    page.reset();

    assert.equal(page.customized, false);
    assert.deepEqual(preferences.overrides("grid"), {});
    assert.deepEqual(preferences.overrides("grid-keybindings"), {});
    assert.deepEqual(preferences.overrides("theme"), { dark: true });
  });
});
