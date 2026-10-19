// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { UvSyncStore } from "../../src/state/UvSyncStore.ts";

describe("UvSyncStore", () => {
  test("writes the blocks on commit by default", () => {
    assert.equal(new UvSyncStore(new Preferences()).value, "commit");
  });
});
