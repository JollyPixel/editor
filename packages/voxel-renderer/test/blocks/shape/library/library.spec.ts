// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Cube,
  Pole,
  PoleY,
  Ramp,
  RampCornerInner,
  RampCornerOuter,
  Slab,
  Stair,
  StairCornerInner,
  StairCornerOuter
} from "../../../../src/blocks/shape/library/index.ts";
import { FACE, FACES } from "../../../../src/utils/math.ts";
import {
  type BlockCollisionHint,
  type BlockShape,
  BlockShapeRegistry
} from "../../../../src/blocks/shape/index.ts";
import { defaultCullFace } from "../../../../src/blocks/face/index.ts";

interface ShapeCase {
  shape: BlockShape;
  id: string;
  collisionHint: BlockCollisionHint;
  faces: number;
  cullable: number;
  occludes: readonly FACE[];
}

// CONSTANTS
const kShapes: readonly ShapeCase[] = [
  {
    shape: new Cube(),
    id: "cube",
    collisionHint: "box",
    faces: 6,
    cullable: 6,
    occludes: FACES
  },
  {
    shape: new Slab("bottom"),
    id: "slabBottom",
    collisionHint: "box",
    faces: 6,
    cullable: 5,
    occludes: [FACE.NegY]
  },
  {
    shape: new Slab("top"),
    id: "slabTop",
    collisionHint: "box",
    faces: 6,
    cullable: 5,
    occludes: [FACE.PosY]
  },
  {
    shape: new PoleY(),
    id: "poleY",
    collisionHint: "trimesh",
    faces: 6,
    cullable: 2,
    occludes: []
  },
  {
    shape: new Pole(),
    id: "pole",
    collisionHint: "trimesh",
    faces: 6,
    cullable: 2,
    occludes: []
  },
  {
    shape: new Ramp(),
    id: "ramp",
    collisionHint: "trimesh",
    faces: 5,
    cullable: 4,
    occludes: [FACE.NegY, FACE.PosZ]
  },
  {
    shape: new RampCornerInner(),
    id: "rampCornerInner",
    collisionHint: "trimesh",
    faces: 7,
    cullable: 6,
    occludes: [FACE.PosX, FACE.NegY, FACE.PosZ]
  },
  {
    shape: new RampCornerOuter(),
    id: "rampCornerOuter",
    collisionHint: "trimesh",
    faces: 5,
    cullable: 3,
    occludes: [FACE.NegY]
  },
  {
    shape: new Stair(),
    id: "stair",
    collisionHint: "trimesh",
    faces: 10,
    cullable: 8,
    occludes: [FACE.NegY, FACE.PosZ]
  },
  {
    shape: new StairCornerInner(),
    id: "stairCornerInner",
    collisionHint: "trimesh",
    faces: 12,
    cullable: 9,
    occludes: [FACE.PosX, FACE.NegY, FACE.PosZ]
  },
  {
    shape: new StairCornerOuter(),
    id: "stairCornerOuter",
    collisionHint: "trimesh",
    faces: 13,
    cullable: 8,
    occludes: [FACE.NegY]
  }
];

describe("Built-in shapes", () => {
  it("are exactly what the default registry holds, in order", () => {
    assert.deepEqual(
      [...BlockShapeRegistry.createDefault().ids()],
      kShapes.map(({ id }) => id)
    );
  });

  for (const { shape, id, collisionHint, faces, cullable, occludes } of kShapes) {
    describe(id, () => {
      it(`is a ${collisionHint} of ${faces} faces, ${cullable} of them cullable`, () => {
        assert.equal(shape.id, id);
        assert.equal(shape.collisionHint, collisionHint);
        assert.equal(shape.faces.length, faces);
        assert.equal(
          shape.faces.filter((face) => defaultCullFace(face) !== null).length,
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
    for (const { shape } of kShapes) {
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

  it("gives every face a unit normal", () => {
    for (const { shape } of kShapes) {
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
    for (const { shape } of kShapes) {
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
