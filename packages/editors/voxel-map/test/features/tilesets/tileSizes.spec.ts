// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { tileSizeSegments } from "../../../src/features/tilesets/tileSizes.ts";

describe("tileSizeSegments", () => {
  it("lists the power-of-two sizes", () => {
    assert.deepEqual(
      tileSizeSegments().map(({ value }) => value),
      [8, 16, 32, 64, 128, 256]
    );
    assert.equal(tileSizeSegments(32)[2].label, "32");
  });

  it("keeps a current size that is not in the list", () => {
    assert.deepEqual(
      tileSizeSegments(1024).map(({ value }) => value),
      [8, 16, 32, 64, 128, 256, 1024]
    );
  });
});
