// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Import Internal Dependencies
import { formatCount } from "../../src/shared/format.ts";

describe("formatCount", () => {
  it("formats counts with grouping and plurals", () => {
    assert.equal(formatCount(0, "voxel"), "0 voxels");
    assert.equal(formatCount(1, "voxel"), "1 voxel");
    assert.equal(formatCount(12345, "voxel"), "12,345 voxels");
  });
});
