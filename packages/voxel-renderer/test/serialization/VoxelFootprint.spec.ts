// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { VoxelFootprint, type VoxelObjectJSON } from "../../src/serialization/index.ts";

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

describe("VoxelFootprint.normalizeExtent", () => {
  it("leaves a whole extent untouched", () => {
    assert.equal(VoxelFootprint.normalizeExtent(1), 1);
    assert.equal(VoxelFootprint.normalizeExtent(7), 7);
  });

  it("rounds a fractional extent to the nearest cell", () => {
    assert.equal(VoxelFootprint.normalizeExtent(2.6), 3);
    assert.equal(VoxelFootprint.normalizeExtent(2.4), 2);
  });

  it("keeps a small positive extent at one cell", () => {
    assert.equal(VoxelFootprint.normalizeExtent(0.5), 1);
    assert.equal(VoxelFootprint.normalizeExtent(0.1), 1);
  });

  it("clamps a zero or negative extent to one cell", () => {
    assert.equal(VoxelFootprint.normalizeExtent(0), 1);
    assert.equal(VoxelFootprint.normalizeExtent(-4), 1);
  });

  it("falls back to one cell for a non-finite extent", () => {
    assert.equal(VoxelFootprint.normalizeExtent(Number.NaN), 1);
    assert.equal(VoxelFootprint.normalizeExtent(Number.POSITIVE_INFINITY), 1);
    assert.equal(VoxelFootprint.normalizeExtent(Number.NEGATIVE_INFINITY), 1);
  });
});

describe("VoxelFootprint", () => {
  it("normalizes both extents on construction", () => {
    const footprint = new VoxelFootprint(2.6, -3);

    assert.equal(footprint.width, 3);
    assert.equal(footprint.height, 1);
  });

  it("exposes Unit as a single cell", () => {
    assert.ok(VoxelFootprint.Unit.equals(new VoxelFootprint(1, 1)));
  });

  it("is frozen", () => {
    assert.ok(Object.isFrozen(new VoxelFootprint(2, 2)));
  });

  it("serializes to the width and height an object stores", () => {
    assert.deepEqual(
      new VoxelFootprint(5, 2).toJSON(),
      { width: 5, height: 2 }
    );
  });
});

describe("VoxelFootprint.of", () => {
  it("occupies a single cell when both extents are absent", () => {
    assert.deepEqual(
      VoxelFootprint.of(makeObject()).toJSON(),
      { width: 1, height: 1 }
    );
  });

  it("defaults only the extent that is missing", () => {
    assert.deepEqual(
      VoxelFootprint.of(makeObject({ width: 4 })).toJSON(),
      { width: 4, height: 1 }
    );
    assert.deepEqual(
      VoxelFootprint.of(makeObject({ height: 3 })).toJSON(),
      { width: 1, height: 3 }
    );
  });

  it("reads whole extents as they are stored", () => {
    assert.deepEqual(
      VoxelFootprint.of(makeObject({ width: 5, height: 2 })).toJSON(),
      { width: 5, height: 2 }
    );
  });

  it("snaps stored extents that are not whole cells", () => {
    assert.deepEqual(
      VoxelFootprint.of(makeObject({ width: 2.6, height: 0.5 })).toJSON(),
      { width: 3, height: 1 }
    );
  });

  it("clamps a zero or negative stored extent to one cell", () => {
    assert.deepEqual(
      VoxelFootprint.of(makeObject({ width: 0, height: -3 })).toJSON(),
      { width: 1, height: 1 }
    );
  });

  it("leaves the object it reads untouched", () => {
    const object = makeObject({ width: 2.6 });
    VoxelFootprint.of(object);

    assert.equal(object.width, 2.6);
    assert.equal(object.height, undefined);
  });
});

describe("VoxelFootprint#equals", () => {
  it("is true for the same normalized area built two ways", () => {
    assert.ok(
      new VoxelFootprint(2.6, 0.5).equals(new VoxelFootprint(3, 1))
    );
  });

  it("matches a stored object against a patch", () => {
    assert.ok(
      VoxelFootprint.of(makeObject({ width: 4 }))
        .equals(new VoxelFootprint(4, 1))
    );
  });

  it("is false when one extent differs", () => {
    assert.equal(
      new VoxelFootprint(2, 2).equals(new VoxelFootprint(2, 3)),
      false
    );
  });
});
