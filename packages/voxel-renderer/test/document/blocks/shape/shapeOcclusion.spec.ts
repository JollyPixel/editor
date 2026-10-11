// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { computeOcclusionMask } from "../../../../src/document/blocks/shape/index.ts";
import { defineFace } from "../../../../src/document/blocks/face/index.ts";
import { FACE } from "../../../../src/document/geometry/faceDirection.ts";

function maskOf(
  faces: readonly FACE[]
): number {
  return faces.reduce<number>((mask, face) => mask | (1 << face), 0);
}

describe("computeOcclusionMask", () => {
  it("sets no bit for a shape without faces", () => {
    assert.equal(computeOcclusionMask([]), 0);
  });

  it("sets the bit of a face covering its whole boundary square", () => {
    const mask = computeOcclusionMask([
      defineFace({
        face: FACE.NegY,
        normal: [0, -1, 0],
        vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]
      })
    ]);

    assert.equal(mask, maskOf([FACE.NegY]));
  });

  it("leaves a half-covered boundary plane clear", () => {
    const mask = computeOcclusionMask([
      defineFace({
        face: FACE.PosX,
        normal: [1, 0, 0],
        vertices: [[1, 0, 0], [1, 0.5, 0], [1, 0.5, 1], [1, 0, 1]]
      })
    ]);

    assert.equal(mask, 0);
  });

  it("adds up the polygons sharing a slot", () => {
    const mask = computeOcclusionMask([
      defineFace({
        face: FACE.PosX,
        normal: [1, 0, 0],
        vertices: [[1, 0, 0], [1, 0.5, 0], [1, 0.5, 1], [1, 0, 1]]
      }),
      defineFace({
        face: FACE.PosX,
        normal: [1, 0, 0],
        vertices: [[1, 0.5, 0], [1, 1, 0], [1, 1, 1], [1, 0.5, 1]]
      })
    ]);

    assert.equal(mask, maskOf([FACE.PosX]));
  });

  it("ignores a face that does not sit on its own boundary plane", () => {
    const mask = computeOcclusionMask([
      defineFace({
        face: FACE.PosY,
        normal: [0, 1, 0],
        vertices: [[0, 0.5, 0], [0, 0.5, 1], [1, 0.5, 1], [1, 0.5, 0]]
      })
    ]);

    assert.equal(mask, 0);
  });

  it("covers a boundary square split into triangles", () => {
    const mask = computeOcclusionMask([
      defineFace({
        face: FACE.NegZ,
        normal: [0, 0, -1],
        vertices: [[0, 0, 0], [1, 1, 0], [1, 0, 0]]
      }),
      defineFace({
        face: FACE.NegZ,
        normal: [0, 0, -1],
        vertices: [[0, 0, 0], [0, 1, 0], [1, 1, 0]]
      })
    ]);

    assert.equal(mask, maskOf([FACE.NegZ]));
  });
});
