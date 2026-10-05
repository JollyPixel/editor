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
  RampTip,
  RampValley,
  Slab,
  Stair,
  StairCornerInner,
  StairCornerOuter,
  StairCornerPeak,
  Wall
} from "../../../../../src/document/blocks/shape/library/index.ts";
import { FACE, FACES } from "../../../../../src/document/geometry/faceDirection.ts";
import type { FaceDefinition } from "../../../../../src/document/blocks/face/index.ts";
import {
  type BlockCollisionHint,
  type BlockShape,
  BlockShapeRegistry
} from "../../../../../src/document/blocks/shape/index.ts";

interface ShapeCase {
  shape: BlockShape;
  id: string;
  collisionHint: BlockCollisionHint;
  faces: number;
  cullable: number;
  occludes: readonly FACE[];
  volume: number;
}

// CONSTANTS
const kShapes: readonly ShapeCase[] = [
  {
    shape: new Cube(),
    id: "cube",
    collisionHint: "box",
    faces: 6,
    cullable: 6,
    occludes: FACES,
    volume: 1
  },
  {
    shape: new Slab("bottom"),
    id: "slabBottom",
    collisionHint: "box",
    faces: 6,
    cullable: 5,
    occludes: [FACE.NegY],
    volume: 1 / 2
  },
  {
    shape: new Slab("top"),
    id: "slabTop",
    collisionHint: "box",
    faces: 6,
    cullable: 5,
    occludes: [FACE.PosY],
    volume: 1 / 2
  },
  {
    shape: new Slab("beam"),
    id: "slabBeam",
    collisionHint: "box",
    faces: 6,
    cullable: 4,
    occludes: [],
    volume: 1 / 4
  },
  {
    shape: new Slab("corner"),
    id: "slabCorner",
    collisionHint: "box",
    faces: 6,
    cullable: 3,
    occludes: [],
    volume: 1 / 8
  },
  {
    shape: new Slab("notch"),
    id: "slabNotch",
    collisionHint: "trimesh",
    faces: 10,
    cullable: 6,
    occludes: [],
    volume: 3 / 8
  },
  {
    shape: new Wall("straight"),
    id: "wall",
    collisionHint: "box",
    faces: 6,
    cullable: 4,
    occludes: [],
    volume: 1 / 4
  },
  {
    shape: new Wall("corner"),
    id: "wallCorner",
    collisionHint: "trimesh",
    faces: 10,
    cullable: 6,
    occludes: [],
    volume: 1 / 4
  },
  {
    shape: new Wall("tee"),
    id: "wallTee",
    collisionHint: "trimesh",
    faces: 12,
    cullable: 7,
    occludes: [],
    volume: 11 / 32
  },
  {
    shape: new Wall("cross"),
    id: "wallCross",
    collisionHint: "trimesh",
    faces: 18,
    cullable: 10,
    occludes: [],
    volume: 7 / 16
  },
  {
    shape: new PoleY(),
    id: "poleY",
    collisionHint: "box",
    faces: 6,
    cullable: 2,
    occludes: [],
    volume: 1 / 16
  },
  {
    shape: new Pole("straight"),
    id: "pole",
    collisionHint: "box",
    faces: 6,
    cullable: 2,
    occludes: [],
    volume: 1 / 16
  },
  {
    shape: new Pole("corner"),
    id: "poleCorner",
    collisionHint: "trimesh",
    faces: 10,
    cullable: 2,
    occludes: [],
    volume: 1 / 16
  },
  {
    shape: new Pole("tee"),
    id: "poleTee",
    collisionHint: "trimesh",
    faces: 12,
    cullable: 3,
    occludes: [],
    volume: 11 / 128
  },
  {
    shape: new Pole("cross"),
    id: "poleCross",
    collisionHint: "trimesh",
    faces: 18,
    cullable: 4,
    occludes: [],
    volume: 7 / 64
  },
  {
    shape: new Pole("end", "up"),
    id: "poleEndUp",
    collisionHint: "trimesh",
    faces: 10,
    cullable: 2,
    occludes: [],
    volume: 1 / 16
  },
  {
    shape: new Pole("straight", "up"),
    id: "poleUp",
    collisionHint: "trimesh",
    faces: 12,
    cullable: 3,
    occludes: [],
    volume: 11 / 128
  },
  {
    shape: new Pole("corner", "up"),
    id: "poleCornerUp",
    collisionHint: "trimesh",
    faces: 15,
    cullable: 3,
    occludes: [],
    volume: 11 / 128
  },
  {
    shape: new Pole("tee", "up"),
    id: "poleTeeUp",
    collisionHint: "trimesh",
    faces: 18,
    cullable: 4,
    occludes: [],
    volume: 7 / 64
  },
  {
    shape: new Pole("cross", "up"),
    id: "poleCrossUp",
    collisionHint: "trimesh",
    faces: 24,
    cullable: 5,
    occludes: [],
    volume: 17 / 128
  },
  {
    shape: new Pole("end", "through"),
    id: "poleEndThrough",
    collisionHint: "trimesh",
    faces: 14,
    cullable: 3,
    occludes: [],
    volume: 11 / 128
  },
  {
    shape: new Pole("straight", "through"),
    id: "poleThrough",
    collisionHint: "trimesh",
    faces: 18,
    cullable: 4,
    occludes: [],
    volume: 7 / 64
  },
  {
    shape: new Pole("corner", "through"),
    id: "poleCornerThrough",
    collisionHint: "trimesh",
    faces: 20,
    cullable: 4,
    occludes: [],
    volume: 7 / 64
  },
  {
    shape: new Pole("tee", "through"),
    id: "poleTeeThrough",
    collisionHint: "trimesh",
    faces: 24,
    cullable: 5,
    occludes: [],
    volume: 17 / 128
  },
  {
    shape: new Pole("cross", "through"),
    id: "poleCrossThrough",
    collisionHint: "trimesh",
    faces: 30,
    cullable: 6,
    occludes: [],
    volume: 5 / 32
  },
  {
    shape: new Ramp(),
    id: "ramp",
    collisionHint: "trimesh",
    faces: 5,
    cullable: 4,
    occludes: [FACE.NegY, FACE.PosZ],
    volume: 1 / 2
  },
  {
    shape: new RampCornerInner(),
    id: "rampCornerInner",
    collisionHint: "trimesh",
    faces: 7,
    cullable: 6,
    occludes: [FACE.PosX, FACE.NegY, FACE.PosZ],
    volume: 5 / 6
  },
  {
    shape: new RampCornerOuter(),
    id: "rampCornerOuter",
    collisionHint: "trimesh",
    faces: 5,
    cullable: 3,
    occludes: [FACE.NegY],
    volume: 1 / 3
  },
  {
    shape: new RampTip(),
    id: "rampTip",
    collisionHint: "trimesh",
    faces: 4,
    cullable: 3,
    occludes: [],
    volume: 1 / 6
  },
  {
    shape: new RampValley(),
    id: "rampValley",
    collisionHint: "trimesh",
    faces: 7,
    cullable: 5,
    occludes: [FACE.PosX, FACE.PosY, FACE.NegZ],
    volume: 2 / 3
  },
  {
    shape: new Stair(),
    id: "stair",
    collisionHint: "trimesh",
    faces: 10,
    cullable: 8,
    occludes: [FACE.NegY, FACE.PosZ],
    volume: 3 / 4
  },
  {
    shape: new StairCornerInner(),
    id: "stairCornerInner",
    collisionHint: "trimesh",
    faces: 12,
    cullable: 9,
    occludes: [FACE.PosX, FACE.NegY, FACE.PosZ],
    volume: 7 / 8
  },
  {
    shape: new StairCornerOuter(),
    id: "stairCornerOuter",
    collisionHint: "trimesh",
    faces: 13,
    cullable: 8,
    occludes: [FACE.NegY],
    volume: 5 / 8
  },
  {
    shape: new StairCornerPeak(),
    id: "stairCornerPeak",
    collisionHint: "trimesh",
    faces: 15,
    cullable: 9,
    occludes: [],
    volume: 1 / 2
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

  it("encloses the volume the shape is meant to fill", () => {
    for (const { shape, volume } of kShapes) {
      const enclosed = enclosedVolume(shape);
      assert.ok(
        Math.abs(enclosed - volume) < 1e-9,
        `${shape.id} encloses ${enclosed} instead of ${volume}`
      );
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

describe("Built-in shapes - joints", () => {
  it("keeps a joint's geometry tied to its type, not its id", () => {
    assert.equal(new Pole("cross", "none", "myCross").faces.length, 18);
    assert.equal(new Pole("cross", "through", "myHub").faces.length, 30);
    assert.equal(new Wall("corner", "myCorner").faces.length, 10);
  });

  it("ends every joint arm on the same section as the straight piece", () => {
    const poles = kShapes
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
        joints: kShapes
          .map(({ shape }) => shape)
          .filter((shape) => shape instanceof Wall)
      }
    ];

    for (const { straight, face, joints } of families) {
      const [end] = capsOf(straight, face);
      for (const joint of joints) {
        assert.deepEqual(capsOf(joint, face), [end], joint.id);
      }
    }
  });
});

function capsOf(
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
