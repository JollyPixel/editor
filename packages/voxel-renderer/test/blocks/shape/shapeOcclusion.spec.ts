// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  occlusionMaskOf
} from "../../../src/blocks/shape/shapeOcclusion.ts";
import {
  BlockShapeRegistry
} from "../../../src/blocks/shape/BlockShapeRegistry.ts";
import { defineFace } from "../../../src/blocks/face/Face.ts";
import {
  FACE,
  FACES
} from "../../../src/utils/math.ts";

function maskOf(
  faces: readonly FACE[]
): number {
  return faces.reduce((mask, face) => mask | (1 << face), 0);
}

describe("occlusionMaskOf", () => {
  it("sets no bit for a shape without faces", () => {
    assert.equal(occlusionMaskOf([]), 0);
  });

  it("sets the bit of a face covering its whole boundary square", () => {
    const mask = occlusionMaskOf([
      defineFace({
        face: FACE.NegY,
        normal: [0, -1, 0],
        vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]
      })
    ]);

    assert.equal(mask, maskOf([FACE.NegY]));
  });

  it("leaves a half-covered boundary plane clear", () => {
    const mask = occlusionMaskOf([
      defineFace({
        face: FACE.PosX,
        normal: [1, 0, 0],
        vertices: [[1, 0, 0], [1, 0.5, 0], [1, 0.5, 1], [1, 0, 1]]
      })
    ]);

    assert.equal(mask, 0);
  });

  it("adds up the polygons sharing a slot", () => {
    const mask = occlusionMaskOf([
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
    const mask = occlusionMaskOf([
      defineFace({
        face: FACE.PosY,
        normal: [0, 1, 0],
        vertices: [[0, 0.5, 0], [0, 0.5, 1], [1, 0.5, 1], [1, 0.5, 0]]
      })
    ]);

    assert.equal(mask, 0);
  });

  it("covers a boundary square split into triangles", () => {
    const mask = occlusionMaskOf([
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

describe("occlusionMaskOf — built-in shapes", () => {
  const kExpected: readonly [string, FACE[]][] = [
    ["cube", [...FACES]],
    ["slabBottom", [FACE.NegY]],
    ["slabTop", [FACE.PosY]],
    ["poleY", []],
    ["pole", []],
    ["ramp", [FACE.NegY, FACE.PosZ]],
    ["rampCornerInner", [FACE.NegY, FACE.PosZ, FACE.PosX]],
    ["rampCornerOuter", [FACE.NegY]],
    ["stair", [FACE.NegY, FACE.PosZ]],
    ["stairCornerInner", [FACE.NegY, FACE.PosZ, FACE.PosX]],
    ["stairCornerOuter", [FACE.NegY]]
  ];

  const registry = BlockShapeRegistry.createDefault();

  for (const [shapeId, faces] of kExpected) {
    it(`derives the documented silhouette of ${shapeId}`, () => {
      const shape = registry.get(shapeId);
      assert.ok(shape, `${shapeId} is not registered`);

      assert.equal(occlusionMaskOf(shape.faces), maskOf(faces));
      for (const face of FACES) {
        assert.equal(
          shape.occludes(face),
          faces.includes(face),
          `${shapeId}.occludes(${face})`
        );
      }
    });
  }
});
