// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  defaultCullFace,
  isBoundaryFace
} from "../../../src/blocks/face/faceCulling.ts";
import { BlockShapeRegistry } from "../../../src/blocks/shape/BlockShapeRegistry.ts";
import { FACE } from "../../../src/utils/math.ts";

describe("isBoundaryFace", () => {
  it("accepts a full quad on its own boundary plane", () => {
    assert.equal(
      isBoundaryFace({
        face: FACE.PosY,
        vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]
      }),
      true
    );
  });

  it("accepts a partial quad, which a full neighbour still covers", () => {
    assert.equal(
      isBoundaryFace({
        face: FACE.PosX,
        vertices: [[1, 0, 0], [1, 0.5, 0], [1, 0.5, 1], [1, 0, 1]]
      }),
      true
    );
  });

  it("rejects a face inset into the block, such as a slab top", () => {
    assert.equal(
      isBoundaryFace({
        face: FACE.PosY,
        vertices: [[0, 0.5, 0], [0, 0.5, 1], [1, 0.5, 1], [1, 0.5, 0]]
      }),
      false
    );
  });

  it("rejects a face spanning several planes, such as a ramp slope", () => {
    assert.equal(
      isBoundaryFace({
        face: FACE.PosY,
        vertices: [[0, 0, 0], [0, 1, 1], [1, 1, 1], [1, 0, 0]]
      }),
      false
    );
  });

  it("reads the negative side of an axis at plane 0", () => {
    assert.equal(
      isBoundaryFace({
        face: FACE.NegZ,
        vertices: [[1, 0, 0], [0, 0, 0], [0, 0.5, 0]]
      }),
      true
    );
    assert.equal(
      isBoundaryFace({
        face: FACE.NegZ,
        vertices: [[1, 0, 0.5], [0, 0, 0.5], [0, 0.5, 0.5]]
      }),
      false
    );
  });
});

describe("defaultCullFace", () => {
  it("culls a boundary face against its own direction", () => {
    assert.equal(
      defaultCullFace({
        face: FACE.NegY,
        vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]
      }),
      FACE.NegY
    );
  });

  it("never culls a face a neighbour cannot cover", () => {
    assert.equal(
      defaultCullFace({
        face: FACE.NegX,
        vertices: [[0.375, 0, 0.625], [0.375, 1, 0.625], [0.375, 1, 0.375]]
      }),
      null
    );
  });
});

describe("defaultCullFace — built-in shapes", () => {
  const registry = BlockShapeRegistry.createDefault();

  it("leaves every cube face culled against its neighbour", () => {
    const shape = registry.get("cube")!;

    for (const face of shape.faces) {
      assert.equal(defaultCullFace(face), face.face);
    }
  });

  /**
   * Each entry is the number of faces a shape may cull. The rest sit inside
   * the block, so a neighbour never hides them.
   */
  const kCullableCounts: readonly [string, number][] = [
    ["cube", 6],
    ["slabBottom", 5],
    ["slabTop", 5],
    ["poleY", 2],
    ["pole", 2],
    ["ramp", 4],
    ["rampCornerInner", 6],
    ["rampCornerOuter", 3],
    ["stair", 8],
    ["stairCornerInner", 9],
    ["stairCornerOuter", 8]
  ];

  for (const [shapeId, expected] of kCullableCounts) {
    it(`keeps ${expected} cullable faces on ${shapeId}`, () => {
      const shape = registry.get(shapeId);
      assert.ok(shape, `${shapeId} is not registered`);

      const cullable = shape.faces.filter(
        (face) => defaultCullFace(face) !== null
      );
      assert.equal(cullable.length, expected);
    });
  }
});
