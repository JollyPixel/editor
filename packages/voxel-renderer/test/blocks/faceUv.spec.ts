// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  faceUvs,
  projectFaceUv,
  projectedFace
} from "../../src/blocks/faceUv.ts";
import { BlockShapeRegistry } from "../../src/blocks/BlockShapeRegistry.ts";
import { FACE } from "../../src/utils/math.ts";

describe("projectFaceUv", () => {
  it("reads a face from outside the block, so u grows rightward", () => {
    assert.deepEqual(projectFaceUv(FACE.PosX, [1, 0.25, 0.75]), [0.75, 0.25]);
    assert.deepEqual(projectFaceUv(FACE.NegX, [0, 0.25, 0.75]), [0.25, 0.25]);
    assert.deepEqual(projectFaceUv(FACE.PosZ, [0.75, 0.25, 1]), [0.75, 0.25]);
    assert.deepEqual(projectFaceUv(FACE.NegZ, [0.75, 0.25, 0]), [0.25, 0.25]);
  });

  it("projects horizontal faces onto the XZ plane", () => {
    assert.deepEqual(projectFaceUv(FACE.PosY, [0.75, 1, 0.25]), [0.75, 0.25]);
    assert.deepEqual(projectFaceUv(FACE.NegY, [0.75, 0, 0.25]), [0.75, 0.75]);
  });
});

describe("faceUvs", () => {
  it("maps a full-height quad onto the whole tile", () => {
    assert.deepEqual(
      faceUvs(FACE.PosZ, [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]),
      [[0, 0], [1, 0], [1, 1], [0, 1]]
    );
  });

  it("keeps a partial quad inside its own footprint", () => {
    assert.deepEqual(
      faceUvs(FACE.PosZ, [[0, 0, 1], [1, 0, 1], [1, 0.5, 1], [0, 0.5, 1]]),
      [[0, 0], [1, 0], [1, 0.5], [0, 0.5]]
    );
  });
});

describe("projectedFace", () => {
  it("derives uvs from the vertices", () => {
    const face = projectedFace({
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1]]
    });

    assert.deepEqual(face.uvs, [[0, 0], [1, 0], [1, 1]]);
  });

  it("keeps explicit uvs so a face can opt out", () => {
    const uvs: [number, number][] = [[0, 0], [0.5, 0], [0.5, 0.5]];
    const face = projectedFace({
      face: FACE.PosZ,
      normal: [0, 0, 1],
      vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1]],
      uvs
    });

    assert.deepEqual(face.uvs, uvs);
  });
});

describe("built-in shape uv convention", () => {
  const shapes = [...BlockShapeRegistry.createDefault().getAll()];

  it("registers every documented shape", () => {
    assert.ok(shapes.length > 0);
  });

  for (const shape of shapes) {
    it(`${shape.id} textures each face over its own footprint`, () => {
      shape.faces.forEach((definition, index) => {
        assert.deepEqual(
          definition.uvs,
          faceUvs(definition.face, definition.vertices),
          `${shape.id} face ${index} (slot ${definition.face}) ` +
          "does not match the projection of its vertices"
        );
      });
    });
  }
});
