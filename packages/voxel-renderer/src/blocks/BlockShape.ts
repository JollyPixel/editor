// Import Internal Dependencies
import type {
  FACE,
  Vec2,
  Vec3
} from "../utils/math.ts";

/**
 * Describes a single polygonal face of a block shape.
 * Vertices and UVs are in 0-to-1 block/tile space.
 * 3 vertices = triangle, 4 vertices = quad (triangulated via [0,1,2] + [0,2,3]).
 */
export interface FaceDefinition {
  /**
   * Texture slot: which of the block's 6 face textures to sample.
   * Also used as the culling direction when `cull` is not specified.
   */
  face: FACE;
  /**
   * Culling direction: which axis-aligned neighbor to check for occlusion.
   * - Omitted → falls back to `face` (default behaviour).
   * - `null`  → always emit; skip neighbor culling entirely (use for interior
   *             faces such as stair risers that have no axis-aligned neighbor).
   * - A `FACE` value → check that specific neighbor instead of `face`.
   */
  cull?: FACE | null;
  /** Outward-pointing surface normal (need not be axis-aligned). */
  normal: Vec3;
  /** 3 (triangle) or 4 (quad) positions in 0-1 block space. */
  vertices: readonly Vec3[];
  /** Same count as vertices; UV coordinates in 0-1 tile space. */
  uvs: readonly Vec2[];
}

export type BlockCollisionHint = "box" | "trimesh" | "none";
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

/**
 * Defines the geometry and culling behaviour of a block shape.
 * Register custom shapes via BlockShapeRegistry to extend the system
 * without modifying core rendering logic.
 */
export interface BlockShape {
  readonly id: BlockShapeID;
  readonly faces: readonly FaceDefinition[];

  /**
   * Returns true if this shape fully covers the given face, allowing
   * the mesh builder to skip emitting the neighbour's opposite face.
   * Only full-coverage faces should return true; partial faces (triangles,
   * ramp sides) should return false to avoid incorrect culling.
   */
  occludes(
    face: FACE
  ): boolean;

  /**
   * Hint to VoxelColliderBuilder for the collision strategy to use.
   * "box"     → cheapest; one cuboid per voxel in a compound shape.
   * "trimesh" → accurate; built from the actual emitted geometry triangles.
   * "none"    → no collision (triggers, decoration, etc.).
   */
  readonly collisionHint: BlockCollisionHint;
}
