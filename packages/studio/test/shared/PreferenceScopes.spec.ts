// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PreferenceScopes } from "../../shared/PreferenceScopes.ts";
import { STUDIO_PREFERENCES } from "../../shared/studioScope.ts";

describe("PreferenceScopes", () => {
  test("prunes stored scopes and fields the descriptors no longer declare", () => {
    const scopes = new PreferenceScopes([STUDIO_PREFERENCES]);

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
