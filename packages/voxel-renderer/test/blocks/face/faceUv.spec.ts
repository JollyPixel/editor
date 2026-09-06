// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  faceUvs,
  projectFaceUv
} from "../../../src/blocks/face/index.ts";
import {
  BlockShapeRegistry
} from "../../../src/blocks/shape/index.ts";
import {
  FACE,
  type Vec2,
  type Vec3
} from "../../../src/utils/math.ts";

describe("projectFaceUv", () => {
  it("reads a face from outside the block, so u grows rightward", () => {
    assert.deepEqual(projectFaceUv(FACE.PosX, [1, 0.25, 0.75]), [0.25, 0.25]);
    assert.deepEqual(projectFaceUv(FACE.NegX, [0, 0.25, 0.75]), [0.75, 0.25]);
    assert.deepEqual(projectFaceUv(FACE.PosZ, [0.75, 0.25, 1]), [0.75, 0.25]);
    assert.deepEqual(projectFaceUv(FACE.NegZ, [0.75, 0.25, 0]), [0.25, 0.25]);
  });

  it("projects horizontal faces onto the XZ plane", () => {
    assert.deepEqual(projectFaceUv(FACE.PosY, [0.75, 1, 0.25]), [0.25, 0.25]);
    assert.deepEqual(projectFaceUv(FACE.NegY, [0.75, 0, 0.25]), [0.25, 0.75]);
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

    it(`${shape.id} never mirrors a tile`, () => {
      shape.faces.forEach((definition, index) => {
        assert.ok(
          windingOf(definition.vertices, definition.normal) ===
          uvWindingOf(definition.uvs),
          `${shape.id} face ${index} (slot ${definition.face}) ` +
          "reads its texture back to front"
        );
      });
    });
  }
});

/**
 * `1` when the polygon winds counter-clockwise as seen from outside the block,
 * `-1` otherwise.
 */
function windingOf(
  vertices: readonly Vec3[],
  normal: Vec3
): number {
  const [a, b, c] = vertices;
  const [e1, e2] = [subtract(b, a), subtract(c, a)];
  const area: Vec3 = [
    (e1[1] * e2[2]) - (e1[2] * e2[1]),
    (e1[2] * e2[0]) - (e1[0] * e2[2]),
    (e1[0] * e2[1]) - (e1[1] * e2[0])
  ];

  return Math.sign(
    (area[0] * normal[0]) + (area[1] * normal[1]) + (area[2] * normal[2])
  );
}

/**
 * Same winding, read in uv space. A tile is mirrored when the two disagree.
 */
function uvWindingOf(
  uvs: readonly Vec2[]
): number {
  const [a, b, c] = uvs;

  return Math.sign(
    ((b[0] - a[0]) * (c[1] - a[1])) - ((b[1] - a[1]) * (c[0] - a[0]))
  );
}

function subtract(
  a: Vec3,
  b: Vec3
): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
