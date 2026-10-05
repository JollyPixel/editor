// Import Internal Dependencies
import type { FACE } from "../../geometry/faceDirection.ts";
import type { FaceDefinition } from "../face/index.ts";

export type BlockCollisionHint =
  | "box"
  | "trimesh"
  | "none";
export type BlockShapeID =
  | "cube"
  | "slabBottom"
  | "slabTop"
  | "slabBeam"
  | "slabCorner"
  | "slabNotch"
  | "wall"
  | "wallCorner"
  | "wallTee"
  | "wallCross"
  | "poleY"
  | "pole"
  | "poleCorner"
  | "poleTee"
  | "poleCross"
  | "poleEndUp"
  | "poleUp"
  | "poleCornerUp"
  | "poleTeeUp"
  | "poleCrossUp"
  | "poleEndThrough"
  | "poleThrough"
  | "poleCornerThrough"
  | "poleTeeThrough"
  | "poleCrossThrough"
  | "ramp"
  | "rampCornerInner"
  | "rampCornerOuter"
  | "rampTip"
  | "rampValley"
  | "stair"
  | "stairCornerInner"
  | "stairCornerOuter"
  | "stairCornerPeak"
  | (string & {});

export interface BlockShape {
  readonly id: BlockShapeID;
  readonly faces: readonly FaceDefinition[];

  occludes(face: FACE): boolean;

  readonly collisionHint: BlockCollisionHint;
}
