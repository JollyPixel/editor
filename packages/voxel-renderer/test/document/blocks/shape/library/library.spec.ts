// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Cube,
  Pole,
  PoleY,
  Slab,
  Wall
} from "../../../../../src/document/blocks/shape/library/index.ts";
import { FACE, FACES } from "../../../../../src/document/geometry/faceDirection.ts";
import type { FaceDefinition } from "../../../../../src/document/blocks/face/index.ts";
import {
  type BlockShape,
  BlockShapeRegistry
} from "../../../../../src/document/blocks/shape/index.ts";
import { BUILT_IN_SHAPE_CASES } from "../../../../helpers/shapeCases.ts";

describe("Built-in shapes", () => {
  it("are exactly what the default registry holds, in order", () => {
    assert.deepEqual(
      [...BlockShapeRegistry.createDefault().ids()],
      BUILT_IN_SHAPE_CASES.map(({ id }) => id)
    );
  });

  for (const { shape, id, collisionHint, faces, cullable, occludes } of BUILT_IN_SHAPE_CASES) {
    describe(id, () => {
      it(`is a ${collisionHint} of ${faces} faces, ${cullable} of them cullable`, () => {
        assert.equal(shape.id, id);
        assert.equal(shape.collisionHint, collisionHint);
        assert.equal(shape.faces.length, faces);
        assert.equal(
          shape.faces.filter((face) => face.cull !== null).length,
          cullable
        );
      });

      it("occludes exactly the faces it covers", () => {
        assert.deepEqual(
          FACES.filter((face) => shape.occludes(face)),
          FACES.filter((face) => occludes.includes(face))
        );
      });
    });
  }
});

describe("Built-in shapes - geometry invariants", () => {
  it("points every polygon normal outward", () => {
    for (const { shape } of BUILT_IN_SHAPE_CASES) {
      for (const face of shape.faces) {
        const [v0, v1, v2] = face.vertices;
        const ax = v1[0] - v0[0];
        const ay = v1[1] - v0[1];
        const az = v1[2] - v0[2];
        const bx = v2[0] - v0[0];
        const by = v2[1] - v0[1];
        const bz = v2[2] - v0[2];
        const dot = (((ay * bz) - (az * by)) * face.normal[0]) +
          (((az * bx) - (ax * bz)) * face.normal[1]) +
          (((ax * by) - (ay * bx)) * face.normal[2]);

        assert.ok(dot > 0, `${shape.id} has an inward-facing polygon`);
      }
    }
  });

  it("encloses the volume the shape is meant to fill", () => {
    for (const { shape, volume } of BUILT_IN_SHAPE_CASES) {
      const enclosed = enclosedVolume(shape);
      assert.ok(
        Math.abs(enclosed - volume) < 1e-9,
        `${shape.id} encloses ${enclosed} instead of ${volume}`
      );
    }
  });

  it("gives every face a unit normal", () => {
    for (const { shape } of BUILT_IN_SHAPE_CASES) {
      for (const [index, { normal }] of shape.faces.entries()) {
        const magnitude = Math.hypot(normal[0], normal[1], normal[2]);
        assert.ok(
          Math.abs(magnitude - 1) < 1e-9,
          `${shape.id} face[${index}] normal magnitude is ${magnitude}`
        );
      }
    }
  });

  it("builds every face from a triangle or a quad", () => {
    for (const { shape } of BUILT_IN_SHAPE_CASES) {
      for (const [index, { vertices }] of shape.faces.entries()) {
        assert.ok(
          vertices.length === 3 || vertices.length === 4,
          `${shape.id} face[${index}] has ${vertices.length} vertices`
        );
      }
    }
  });
});

describe("Built-in shapes - construction", () => {
  it("takes a custom id", () => {
    assert.equal(new Cube("myCustomCube").id, "myCustomCube");
  });

  it("keeps a slab's occlusion tied to its type, not its id", () => {
    for (const id of ["myBottomSlab", "slab"]) {
      const bottom = new Slab("bottom", id);
      assert.ok(bottom.occludes(FACE.NegY));
      assert.ok(!bottom.occludes(FACE.PosY));
    }

    const top = new Slab("top", "myBottomSlab");
    assert.ok(top.occludes(FACE.PosY));
    assert.ok(!top.occludes(FACE.NegY));
  });
});

describe("Built-in shapes - joints", () => {
  it("keeps a joint's geometry tied to its type, not its id", () => {
    assert.equal(new Pole("cross", "none", "myCross").faces.length, 18);
    assert.equal(new Pole("cross", "through", "myHub").faces.length, 30);
    assert.equal(new Wall("corner", "myCorner").faces.length, 10);
  });

  it("ends every joint arm on the same section as the straight piece", () => {
    const poles = BUILT_IN_SHAPE_CASES
      .map(({ shape }) => shape)
      .filter((shape) => shape instanceof Pole);
    const families = [
      {
        straight: new Pole(),
        face: FACE.PosZ,
        joints: poles
      },
      {
        straight: new PoleY(),
        face: FACE.PosY,
        joints: poles.filter(({ id }) => /(?:Up|Through)$/u.test(id))
      },
      {
        straight: new Wall(),
        face: FACE.PosZ,
        joints: BUILT_IN_SHAPE_CASES
          .map(({ shape }) => shape)
          .filter((shape) => shape instanceof Wall)
      }
    ];

    for (const { straight, face, joints } of families) {
      const [end] = findCaps(straight, face);
      for (const joint of joints) {
        assert.deepEqual(findCaps(joint, face), [end], joint.id);
      }
    }
  });
});

function findCaps(
  shape: BlockShape,
  face: FACE
): FaceDefinition[] {
  return shape.faces.filter(
    (definition) => definition.face === face && definition.cull === face
  );
}

function enclosedVolume(
  shape: BlockShape
): number {
  let sixTimesVolume = 0;
  for (const { vertices } of shape.faces) {
    const [a] = vertices;
    for (let corner = 1; corner < vertices.length - 1; corner++) {
      const b = vertices[corner];
      const c = vertices[corner + 1];
      sixTimesVolume += (a[0] * ((b[1] * c[2]) - (b[2] * c[1]))) -
        (a[1] * ((b[0] * c[2]) - (b[2] * c[0]))) +
        (a[2] * ((b[0] * c[1]) - (b[1] * c[0])));
    }
  }

  return sixTimesVolume / 6;
}
