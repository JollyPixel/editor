// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  LANTERN_PREFERENCES,
  PreferenceStorage,
  Preferences,
  RUNTIME_PREFERENCES
} from "#src/index.ts";

describe("PreferenceStorage", () => {
  test("keeps each key as an entry of one preference field", () => {
    const preferences = new Preferences();
    const storage = new PreferenceStorage(
      preferences,
      LANTERN_PREFERENCES,
      "seen"
    );

    storage.set("jolly-pixel:lantern:basics", "2");
    storage.set("jolly-pixel:lantern:blocks", "1");

    assert.equal(storage.get("jolly-pixel:lantern:basics"), "2");
    assert.equal(storage.get("jolly-pixel:lantern:missing"), null);
    assert.deepEqual(preferences.overrides("lantern"), {
      seen: {
        "jolly-pixel:lantern:basics": "2",
        "jolly-pixel:lantern:blocks": "1"
      }
    });

    preferences.reset(LANTERN_PREFERENCES);

    assert.equal(storage.get("jolly-pixel:lantern:basics"), null);
  });

  test("refuses a field that does not hold entries", () => {
    assert.throws(
      () => new PreferenceStorage(new Preferences(), RUNTIME_PREFERENCES, "stats"),
      TypeError
    );
  });
});
