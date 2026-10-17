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
} from "../../src/document/blocks/shape/library/index.ts";
import { FACE, FACES } from "../../src/document/geometry/faceDirection.ts";
import type {
  BlockCollisionHint,
  BlockShape
} from "../../src/document/blocks/shape/index.ts";

export interface ShapeCase {
  shape: BlockShape;
  id: string;
  collisionHint: BlockCollisionHint;
  faces: number;
  cullable: number;
  occludes: readonly FACE[];
  volume: number;
}

export const BUILT_IN_SHAPE_CASES: readonly ShapeCase[] = [
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
