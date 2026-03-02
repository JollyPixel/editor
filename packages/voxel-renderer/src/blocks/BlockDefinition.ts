// Import Internal Dependencies
import type { TileRef, TileRefIn } from "../tileset/types.ts";
import type { FACE } from "../utils/math.ts";
import type { BlockShapeID } from "./BlockShape.ts";

export interface BlockDef {
  /**
   * Unique numeric identifier.
   * @note
   * 0 is reserved for air.
   **/
  id: number;
  /** Human-readable name for editor display. */
  name: string;
  /** ID of the BlockShape to use for geometry generation. */
  shapeId: BlockShapeID;
  /** If false, the mesh builder will not emit collision geometry for this block. */
  collidable: boolean;
}

interface BlockDefTextures<T extends TileRef | TileRefIn> {
  /**
   * Per-face tile references. If a face is absent, defaultTexture is used.
   * Allows grass blocks to have a different top texture from their sides.
   */
  faceTextures: Partial<Record<FACE, T>>;
  /** Fallback tile used for any face not listed in faceTextures. */
  defaultTexture?: T;
}

/**
 * Describes a block type: its shape, per-face texture tiles, and collidability.
 * Block ID 0 is always air and is never stored in the registry.
 */
export interface BlockDefinition extends BlockDef, BlockDefTextures<TileRef> { }

/**
 * A version of BlockDefinition that is easier to use than the later, used in the entry point of the voxel render
 */
export interface BlockDefinitionIn extends BlockDef, BlockDefTextures<TileRefIn> {
  /** Fallback tile set id used for any tile ref that does not have a tileset id.*/
  defaultTilesetId?: string;
}
