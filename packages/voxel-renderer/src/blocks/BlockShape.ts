// Import Internal Dependencies
import type {
  FACE,
  Vec2,
  Vec3
} from "../utils/math.ts";

/**
 * A triangle or quad in normalized block and tile space.
 */
export interface FaceDefinition {
  /**
   * Texture slot and default culling direction.
   */
  face: FACE;
  /**
   * Occlusion neighbor; omitted uses `face`, while `null` disables culling.
   */
  cull?: FACE | null;
  /**
   * Outward normal, which need not be axis-aligned.
   */
  normal: Vec3;
  /**
   * Three or four positions in normalized block space.
   */
  vertices: readonly Vec3[];
  /**
   * One normalized tile-space UV per vertex.
   */
  uvs: readonly Vec2[];
}

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
