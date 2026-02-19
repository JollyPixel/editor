// Import Internal Dependencies
import type { TileRef } from "../tileset/types.ts";
import type { FACE } from "../utils/math.ts";
import type { BlockShapeID } from "./BlockShape.ts";

/**
 * Describes a block type: its shape, per-face texture tiles, and collidability.
 * Block ID 0 is always air and is never stored in the registry.
 */
export interface BlockDefinition {
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
  /**
   * Per-face tile references. If a face is absent, defaultTexture is used.
   * Allows grass blocks to have a different top texture from their sides.
   */
  faceTextures: Partial<Record<FACE, TileRef>>;
  /** Fallback tile used for any face not listed in faceTextures. */
  defaultTexture?: TileRef;
  /** If false, the mesh builder will not emit collision geometry for this block. */
  collidable: boolean;
}
