// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { tileSizeOptions } from "../../../src/features/tilesets/tileSizes.ts";

describe("tileSizeOptions", () => {
  it("lists the power-of-two sizes", () => {
    assert.deepEqual(
      tileSizeOptions().map(({ value }) => value),
      [8, 16, 32, 64, 128, 256]
    );
    assert.equal(tileSizeOptions(32)[2].label, "32px");
  });

  it("keeps a current size that is not in the list", () => {
    assert.deepEqual(
      tileSizeOptions(1024).map(({ value }) => value),
      [8, 16, 32, 64, 128, 256, 1024]
    );
  });
});
