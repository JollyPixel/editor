// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { normalizeVoxelExtent } from "../../src/lib/voxelExtent.ts";

describe("normalizeVoxelExtent", () => {
  it("rounds positive dimensions to whole voxels", () => {
    assert.equal(normalizeVoxelExtent(2.6), 3);
  });

  it("clamps zero, negative, and non-finite dimensions to one", () => {
    assert.equal(normalizeVoxelExtent(0), 1);
    assert.equal(normalizeVoxelExtent(-4), 1);
    assert.equal(normalizeVoxelExtent(Number.NaN), 1);
    assert.equal(normalizeVoxelExtent(Number.POSITIVE_INFINITY), 1);
  });
});
