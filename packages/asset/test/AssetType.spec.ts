// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { AssetType } from "../src/index.ts";

describe("AssetType", () => {
  test("rejects a blank kind", () => {
    assert.throws(
      () => new AssetType(" "),
      {
        name: "TypeError",
        message: /kind must not be empty/
      }
    );
  });
});
