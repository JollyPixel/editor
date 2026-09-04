// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  voxelCellOf,
  voxelPositionOf
} from "../../src/world/voxelCoord.ts";
import { SQRT2_OVER_2 } from "../../src/constants.ts";

describe("voxelCellOf", () => {
  it("keeps a point already on a cell corner", () => {
    assert.deepEqual(
      voxelCellOf({ x: 3, y: 1, z: 4 }),
      { x: 3, y: 1, z: 4 }
    );
  });

  it("takes the cell a point falls inside", () => {
    assert.deepEqual(
      voxelCellOf({ x: 3.2, y: 1.9, z: 4.7 }),
      { x: 3, y: 1, z: 4 }
    );
  });

  it("floors rather than rounds, so a cell owns its whole span", () => {
    assert.deepEqual(
      voxelCellOf({ x: 3.5, y: 0.5, z: 4.5 }),
      { x: 3, y: 0, z: 4 }
    );
  });

  it("walks away from zero on negative coordinates", () => {
    assert.deepEqual(
      voxelCellOf({ x: -0.2, y: -1.5, z: -33 }),
      { x: -1, y: -2, z: -33 }
    );
  });
});

describe("voxelPositionOf", () => {
  const point = { x: 3.2, y: 1, z: 4.7 };
  const up = { x: 0, y: 1, z: 0 };

  it("takes the free cell in front of the surface", () => {
    assert.deepEqual(
      voxelPositionOf(point, up, "front"),
      { x: 3, y: 1, z: 4 }
    );
  });

  it("takes the cell the surface belongs to on the back side", () => {
    assert.deepEqual(
      voxelPositionOf(point, up, "back"),
      { x: 3, y: 0, z: 4 }
    );
  });

  it("defaults to the front side", () => {
    assert.deepEqual(
      voxelPositionOf(point, up),
      voxelPositionOf(point, up, "front")
    );
  });

  it("steps along whichever axis the normal points down", () => {
    const face = { x: 5, y: 2.5, z: 2.5 };

    assert.deepEqual(
      voxelPositionOf(face, { x: 1, y: 0, z: 0 }, "front"),
      { x: 5, y: 2, z: 2 }
    );
    assert.deepEqual(
      voxelPositionOf(face, { x: 1, y: 0, z: 0 }, "back"),
      { x: 4, y: 2, z: 2 }
    );
  });

  it("resolves a ramp slope hit to the ramp cell, whatever the height", () => {
    const slope = { x: 0, y: SQRT2_OVER_2, z: -SQRT2_OVER_2 };

    assert.deepEqual(
      voxelPositionOf({ x: 3.5, y: 2.3, z: 4.7 }, slope, "back"),
      { x: 3, y: 2, z: 4 }
    );
    assert.deepEqual(
      voxelPositionOf({ x: 3.5, y: 2.9, z: 4.1 }, slope, "back"),
      { x: 3, y: 2, z: 4 }
    );
  });

  it("stacks on top of a ramp slope rather than inside it", () => {
    const slope = { x: 0, y: SQRT2_OVER_2, z: -SQRT2_OVER_2 };

    assert.deepEqual(
      voxelPositionOf({ x: 3.5, y: 2.3, z: 4.7 }, slope, "front"),
      { x: 3, y: 3, z: 4 }
    );
  });

  it("steps one cell at most, however slanted the normal is", () => {
    const normal = { x: 0.6, y: 0.5, z: 0.62 };

    assert.deepEqual(
      voxelPositionOf({ x: 1.5, y: 1.5, z: 1.5 }, normal),
      { x: 1, y: 1, z: 2 }
    );
  });

  it("leaves the point and normal it reads untouched", () => {
    const readPoint = { x: 3.2, y: 1, z: 4.7 };
    const readNormal = { x: 0, y: 1, z: 0 };
    voxelPositionOf(readPoint, readNormal, "back");

    assert.deepEqual(readPoint, { x: 3.2, y: 1, z: 4.7 });
    assert.deepEqual(readNormal, { x: 0, y: 1, z: 0 });
  });
});
