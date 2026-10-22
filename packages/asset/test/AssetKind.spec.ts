// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Internal Dependencies
import { AssetKind } from "../src/index.ts";

describe("AssetKind", () => {
  test("rejects a blank kind or a kind with a room separator", () => {
    for (const kind of ["", " ", "pixel:art", "pixel@art"]) {
      assert.throws(
        () => new AssetKind(kind),
        {
          name: "TypeError",
          message: /kind must be non-empty without ":" or "@"/
        }
      );
    }
  });
});
