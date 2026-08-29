// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  normalizeVoxelExtent,
  voxelObjectFootprint
} from "../../src/serialization/voxelObject.ts";
import type { VoxelObjectJSON } from "../../src/serialization/VoxelSerializer.ts";

function makeObject(
  patch: Partial<VoxelObjectJSON> = {}
): VoxelObjectJSON {
  return {
    id: "obj-1",
    name: "Spawn",
    x: 0,
    y: 0,
    z: 0,
    visible: true,
    ...patch
  };
}

describe("normalizeVoxelExtent", () => {
  it("leaves a whole extent untouched", () => {
    assert.equal(normalizeVoxelExtent(1), 1);
    assert.equal(normalizeVoxelExtent(7), 7);
  });

  it("rounds a fractional extent to whole voxels", () => {
    assert.equal(normalizeVoxelExtent(2.6), 3);
    assert.equal(normalizeVoxelExtent(2.4), 2);
  });

  it("clamps a fraction that would round down to nothing", () => {
    assert.equal(normalizeVoxelExtent(0.5), 1);
    assert.equal(normalizeVoxelExtent(0.1), 1);
  });

  it("clamps zero and negative extents to one", () => {
    assert.equal(normalizeVoxelExtent(0), 1);
    assert.equal(normalizeVoxelExtent(-4), 1);
  });

  it("clamps non-finite extents to one", () => {
    assert.equal(normalizeVoxelExtent(Number.NaN), 1);
    assert.equal(normalizeVoxelExtent(Number.POSITIVE_INFINITY), 1);
    assert.equal(normalizeVoxelExtent(Number.NEGATIVE_INFINITY), 1);
  });
});

describe("voxelObjectFootprint", () => {
  it("occupies a single cell when both extents are absent", () => {
    assert.deepEqual(
      voxelObjectFootprint(makeObject()),
      { width: 1, height: 1 }
    );
  });

  it("defaults only the extent that is missing", () => {
    assert.deepEqual(
      voxelObjectFootprint(makeObject({ width: 4 })),
      { width: 4, height: 1 }
    );
    assert.deepEqual(
      voxelObjectFootprint(makeObject({ height: 3 })),
      { width: 1, height: 3 }
    );
  });

  it("reads whole extents as they are stored", () => {
    assert.deepEqual(
      voxelObjectFootprint(makeObject({ width: 5, height: 2 })),
      { width: 5, height: 2 }
    );
  });

  it("snaps stored extents that are not whole cells", () => {
    assert.deepEqual(
      voxelObjectFootprint(makeObject({ width: 2.6, height: 0.5 })),
      { width: 3, height: 1 }
    );
  });

  it("clamps a zero or negative stored extent to one cell", () => {
    assert.deepEqual(
      voxelObjectFootprint(makeObject({ width: 0, height: -3 })),
      { width: 1, height: 1 }
    );
  });

  it("leaves the object it reads untouched", () => {
    const object = makeObject({ width: 2.6 });
    voxelObjectFootprint(object);

    assert.equal(object.width, 2.6);
    assert.equal(object.height, undefined);
  });
});
