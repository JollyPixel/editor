// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { floorVoxelPosition, resolveSurfaceCell } from "../../../src/document/geometry/index.ts";

// CONSTANTS
const kSqrt2Over2 = Math.SQRT2 / 2;

describe("floorVoxelPosition", () => {
  it("keeps a point already on a cell corner", () => {
    assert.deepEqual(
      floorVoxelPosition({ x: 3, y: 1, z: 4 }),
      { x: 3, y: 1, z: 4 }
    );
  });

  it("takes the cell a point falls inside", () => {
    assert.deepEqual(
      floorVoxelPosition({ x: 3.2, y: 1.9, z: 4.7 }),
      { x: 3, y: 1, z: 4 }
    );
  });

  it("walks away from zero on negative coordinates", () => {
    assert.deepEqual(
      floorVoxelPosition({ x: -0.2, y: -1.5, z: -33 }),
      { x: -1, y: -2, z: -33 }
    );
  });
});

describe("resolveSurfaceCell", () => {
  const point = { x: 3.2, y: 1, z: 4.7 };
  const up = { x: 0, y: 1, z: 0 };

  it("takes the free cell in front of the surface", () => {
    assert.deepEqual(
      resolveSurfaceCell(point, up, "front"),
      { x: 3, y: 1, z: 4 }
    );
  });

  it("takes the cell the surface belongs to on the back side", () => {
    assert.deepEqual(
      resolveSurfaceCell(point, up, "back"),
      { x: 3, y: 0, z: 4 }
    );
  });

  it("defaults to the front side", () => {
    assert.deepEqual(
      resolveSurfaceCell(point, up),
      resolveSurfaceCell(point, up, "front")
    );
  });

  it("steps along whichever axis the normal points down", () => {
    const face = { x: 5, y: 2.5, z: 2.5 };

    assert.deepEqual(
      resolveSurfaceCell(face, { x: 1, y: 0, z: 0 }, "front"),
      { x: 5, y: 2, z: 2 }
    );
    assert.deepEqual(
      resolveSurfaceCell(face, { x: 1, y: 0, z: 0 }, "back"),
      { x: 4, y: 2, z: 2 }
    );
  });

  it("resolves a ramp slope hit to the ramp cell, whatever the height", () => {
    const slope = { x: 0, y: kSqrt2Over2, z: -kSqrt2Over2 };

    assert.deepEqual(
      resolveSurfaceCell({ x: 3.5, y: 2.3, z: 4.7 }, slope, "back"),
      { x: 3, y: 2, z: 4 }
    );
    assert.deepEqual(
      resolveSurfaceCell({ x: 3.5, y: 2.9, z: 4.1 }, slope, "back"),
      { x: 3, y: 2, z: 4 }
    );
  });

  it("stacks on top of a ramp slope rather than inside it", () => {
    const slope = { x: 0, y: kSqrt2Over2, z: -kSqrt2Over2 };

    assert.deepEqual(
      resolveSurfaceCell({ x: 3.5, y: 2.3, z: 4.7 }, slope, "front"),
      { x: 3, y: 3, z: 4 }
    );
  });

  it("steps one cell at most, however slanted the normal is", () => {
    const normal = { x: 0.6, y: 0.5, z: 0.62 };

    assert.deepEqual(
      resolveSurfaceCell({ x: 1.5, y: 1.5, z: 1.5 }, normal),
      { x: 1, y: 1, z: 2 }
    );
  });

  it("leaves the point and normal it reads untouched", () => {
    const readPoint = { x: 3.2, y: 1, z: 4.7 };
    const readNormal = { x: 0, y: 1, z: 0 };
    resolveSurfaceCell(readPoint, readNormal, "back");

    assert.deepEqual(readPoint, { x: 3.2, y: 1, z: 4.7 });
    assert.deepEqual(readNormal, { x: 0, y: 1, z: 0 });
  });
});
