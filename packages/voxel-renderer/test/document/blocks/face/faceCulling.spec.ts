// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  defaultCullFace,
  isBoundaryFace
} from "../../../../src/document/blocks/face/index.ts";
import { FACE } from "../../../../src/document/geometry/faceDirection.ts";

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
