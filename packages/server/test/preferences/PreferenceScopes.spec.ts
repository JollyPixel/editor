// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { definePreferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { PreferenceScopes } from "#src/preferences/PreferenceScopes.ts";

// CONSTANTS
const kStudioScope = definePreferences({
  name: "studio",
  label: "Appearance",
  fields: {
    theme: {
      type: "enum",
      label: "Theme",
      options: [
        {
          value: "light",
          label: "Light"
        },
        {
          value: "dark",
          label: "Dark"
        }
      ],
      default: "dark"
    }
  }
});

describe("PreferenceScopes", () => {
  test("prunes stored scopes and fields the descriptors no longer declare", () => {
    const scopes = new PreferenceScopes({
      scopes: [kStudioScope],
      common: []
    }, []);

    const overrides = scopes.prune([
      [
        "studio",
        {
          theme: "light",
          retired: true
        }
      ],
      [
        "retired",
        {
          speed: 2
        }
      ]
    ]);

    assert.deepEqual(overrides, new Map([
      ["studio", { theme: "light" }]
    ]));
  });
});
