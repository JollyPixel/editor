// Import Internal Dependencies
import type { FACE } from "../../utils/math.ts";
import type { FaceDefinition } from "../face/index.ts";

export type BlockCollisionHint =
  | "box"
  | "trimesh"
  | "none";
export type BlockShapeID =
  | "cube"
  | "slabBottom"
  | "slabTop"
  | "poleY"
  | "pole"
  | "ramp"
  | "rampCornerInner"
  | "rampCornerOuter"
  | "stair"
  | "stairCornerInner"
  | "stairCornerOuter"
  | (string & {});

export interface BlockShape {
  readonly id: BlockShapeID;
  readonly faces: readonly FaceDefinition[];

  occludes(face: FACE): boolean;

  readonly collisionHint: BlockCollisionHint;
}
