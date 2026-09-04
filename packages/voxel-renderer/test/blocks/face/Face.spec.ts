// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { defineFace } from "../../../src/blocks/face/Face.ts";
import {
  BlockShapeRegistry
} from "../../../src/blocks/shape/BlockShapeRegistry.ts";
import { FACE } from "../../../src/utils/math.ts";

describe("defineFace", () => {
  it("derives uvs from the vertices", () => {
    const face = defineFace({
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1]]
    });

    assert.deepEqual(face.uvs, [[0, 0], [1, 0], [1, 1]]);
  });

  it("keeps explicit uvs so a face can opt out", () => {
    const uvs: [number, number][] = [[0, 0], [0.5, 0], [0.5, 0.5]];
    const face = defineFace({
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1]],
      uvs
    });

    assert.deepEqual(face.uvs, uvs);
  });

  it("culls a boundary face against its own direction", () => {
    const face = defineFace({
      face: FACE.NegY,
      normal: [0, -1, 0],
      vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]]
    });

    assert.equal(face.cull, FACE.NegY);
  });

  it("leaves an inset face unculled", () => {
    const face = defineFace({
      face: FACE.PosY,
      normal: [0, 1, 0],
      vertices: [[0, 0.5, 0], [0, 0.5, 1], [1, 0.5, 1], [1, 0.5, 0]]
    });

    assert.equal(face.cull, null);
  });

  it("keeps an explicit cull, including null on a boundary face", () => {
    const boundary = {
      face: FACE.NegY,
      normal: [0, -1, 0] as [number, number, number],
      vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] as [
        number, number, number
      ][]
    };

    assert.equal(defineFace({ ...boundary, cull: null }).cull, null);
    assert.equal(
      defineFace({ ...boundary, cull: FACE.PosX }).cull,
      FACE.PosX
    );
  });

  it("resolves cull on every built-in face", () => {
    for (const shape of BlockShapeRegistry.createDefault()) {
      for (const face of shape.faces) {
        assert.notEqual(
          face.cull,
          undefined,
          `${shape.id} left a face unresolved`
        );
      }
    }
  });
});
