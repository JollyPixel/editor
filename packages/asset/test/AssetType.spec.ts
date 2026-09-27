// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { AssetType } from "../src/index.ts";

describe("AssetType", () => {
  test("rejects a blank kind or a kind with a colon", () => {
    for (const kind of [" ", "pixel:art"]) {
      assert.throws(
        () => new AssetType(kind),
        {
          name: "TypeError",
          message: /kind must be non-empty without a colon/
        }
      );
    }
  });
});
