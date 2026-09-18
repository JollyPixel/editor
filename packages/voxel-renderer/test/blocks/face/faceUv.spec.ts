// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  defineFace,
  faceUvs,
  faceUvSpan,
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

describe("faceUvSpan", () => {
  it("is one tile on an axis-aligned face", () => {
    assert.deepEqual(faceUvSpan(FACE.PosZ, [0, 0, 1]), { u: 1, v: 1 });
  });

  it("stretches v by the slope length of a ramp", () => {
    const span = faceUvSpan(FACE.PosY, [0, Math.SQRT1_2, -Math.SQRT1_2]);

    assert.equal(span.u, 1);
    assert.ok(Math.abs(span.v - Math.SQRT2) < 1e-9);
  });

  it("stretches u when the face leans along it", () => {
    const span = faceUvSpan(FACE.PosZ, [Math.SQRT1_2, 0, Math.SQRT1_2]);

    assert.ok(Math.abs(span.u - Math.SQRT2) < 1e-9);
    assert.equal(span.v, 1);
  });

  it("stays one tile when the face leans along both axes", () => {
    const third = Math.sqrt(1 / 3);

    assert.deepEqual(
      faceUvSpan(FACE.PosY, [-third, third, -third]),
      { u: 1, v: 1 }
    );
  });

  it("stays one tile when the normal is parallel to the face plane", () => {
    assert.deepEqual(faceUvSpan(FACE.PosY, [1, 0, 0]), { u: 1, v: 1 });
  });

  it("ignores faces with authored uvs", () => {
    const face = defineFace({
      face: FACE.PosY,
      normal: [0, Math.SQRT1_2, -Math.SQRT1_2],
      vertices: [[0, 0, 0], [0, 1, 1], [1, 1, 1], [1, 0, 0]],
      uvs: [[1, 0], [1, 1], [0, 1], [0, 0]]
    });

    assert.deepEqual(face.span, { u: 1, v: 1 });
  });
});

describe("built-in shape uv convention", () => {
  const shapes = [...BlockShapeRegistry.createDefault().getAll()];

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

    it(`${shape.id} span restores the true length of unsheared edges`, () => {
      for (const definition of shape.faces) {
        const span = definition.span ?? { u: 1, v: 1 };
        const axisAligned = definition.normal.filter((n) => n !== 0).length === 1;
        if (!axisAligned && span.u === 1 && span.v === 1) {
          continue;
        }

        definition.vertices.forEach((vertex, index) => {
          const next = (index + 1) % definition.vertices.length;
          const uv = definition.uvs[index];
          const nextUv = definition.uvs[next];
          const texture = Math.hypot(
            (nextUv[0] - uv[0]) * span.u,
            (nextUv[1] - uv[1]) * span.v
          );
          const world = Math.hypot(...subtract(definition.vertices[next], vertex));

          assert.ok(
            Math.abs(texture - world) < 1e-6,
            `${shape.id} face ${definition.face} edge ${index} is stretched`
          );
        });
      }
    });
  }
});

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
