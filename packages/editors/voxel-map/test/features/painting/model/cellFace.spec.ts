// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  CELL_FACES,
  cellFaceOf,
  faceCornersOf,
  isCellFace
} from "../../../../src/features/painting/model/cellFace.ts";
import type { BrushFootprint } from "../../../../src/features/painting/model/brushFootprint.ts";

function footprint(
  patch: Partial<BrushFootprint> = {}
): BrushFootprint {
  return {
    position: { x: 0, y: 0, z: 0 },
    size: 1,
    axis: "xz",
    pattern: "square",
    ...patch
  };
}

describe("isCellFace", () => {
  test("accepts the six faces and nothing else", () => {
    for (const face of CELL_FACES) {
      assert.ok(isCellFace(face));
    }

    for (const value of ["x", "+w", "", null, undefined, 1, { face: "+x" }]) {
      assert.ok(!isCellFace(value));
    }
  });
});

describe("cellFaceOf", () => {
  test("maps each unit direction to its face", () => {
    assert.strictEqual(cellFaceOf({ x: 1, y: 0, z: 0 }), "+x");
    assert.strictEqual(cellFaceOf({ x: -1, y: 0, z: 0 }), "-x");
    assert.strictEqual(cellFaceOf({ x: 0, y: 1, z: 0 }), "+y");
    assert.strictEqual(cellFaceOf({ x: 0, y: -1, z: 0 }), "-y");
    assert.strictEqual(cellFaceOf({ x: 0, y: 0, z: 1 }), "+z");
    assert.strictEqual(cellFaceOf({ x: 0, y: 0, z: -1 }), "-z");
  });

  test("snaps a slanted normal to its dominant axis", () => {
    assert.strictEqual(cellFaceOf({ x: 0, y: 0.7, z: -0.6 }), "+y");
    assert.strictEqual(cellFaceOf({ x: -0.8, y: 0.1, z: 0.5 }), "-x");
    assert.strictEqual(cellFaceOf({ x: 0.2, y: -0.3, z: -0.9 }), "-z");
  });

  test("prefers the vertical axis on a tie", () => {
    assert.strictEqual(cellFaceOf({ x: 0.5, y: -0.5, z: 0 }), "-y");
  });
});

describe("faceCornersOf", () => {
  test("covers the aimed cell face for a single cell brush", () => {
    assert.deepStrictEqual(
      faceCornersOf(footprint({ position: { x: 2, y: 0, z: -3 } }), "+y"),
      [
        { x: 2, y: 1, z: -3 },
        { x: 3, y: 1, z: -3 },
        { x: 3, y: 1, z: -2 },
        { x: 2, y: 1, z: -2 }
      ]
    );
  });

  test("scales with the brush size", () => {
    assert.deepStrictEqual(
      faceCornersOf(footprint({ size: 3 }), "-y"),
      [
        { x: -1, y: 0, z: -1 },
        { x: 2, y: 0, z: -1 },
        { x: 2, y: 0, z: 2 },
        { x: -1, y: 0, z: 2 }
      ]
    );
  });

  test("spans the footprint side on a vertical face", () => {
    assert.deepStrictEqual(
      faceCornersOf(footprint({ size: 3 }), "+x"),
      [
        { x: 1, y: 0, z: -1 },
        { x: 1, y: 1, z: -1 },
        { x: 1, y: 1, z: 2 },
        { x: 1, y: 0, z: 2 }
      ]
    );
  });

  test("stays on the aimed face of a volume brush", () => {
    const corners = faceCornersOf(
      footprint({ size: 4, axis: "xyz" }),
      "+y"
    );

    assert.ok(corners.every((corner) => corner.y === 1));
  });

  test("draws a square around a circle brush", () => {
    assert.deepStrictEqual(
      faceCornersOf(footprint({ size: 4, pattern: "circle" }), "+y"),
      faceCornersOf(footprint({ size: 4 }), "+y")
    );
  });

  test("grows and lifts the rectangle by the margin", () => {
    assert.deepStrictEqual(
      faceCornersOf(footprint(), "-z", 0.25),
      [
        { x: -0.25, y: -0.25, z: -0.25 },
        { x: 1.25, y: -0.25, z: -0.25 },
        { x: 1.25, y: 1.25, z: -0.25 },
        { x: -0.25, y: 1.25, z: -0.25 }
      ]
    );
  });
});
