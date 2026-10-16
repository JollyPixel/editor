// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  PREFETCH_EDITORS_STORAGE_KEY,
  StudioPreferences
} from "../../src/preferences/StudioPreferences.ts";

describe("StudioPreferences", () => {
  test("prefetches editors unless the stored flag is off", () => {
    const cases: Array<[string | null, boolean]> = [
      [null, true],
      ["on", true],
      ["off", false]
    ];

    for (const [stored, expected] of cases) {
      const storage = new MemoryStorageAdapter();
      if (stored !== null) {
        storage.set(PREFETCH_EDITORS_STORAGE_KEY, stored);
      }

      assert.equal(
        new StudioPreferences(storage).prefetchEditors,
        expected
      );
    }
  });
});
