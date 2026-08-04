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
  /**
   * Set it on any block you can see through.
   * A transparent block never hides a neighbouring face.
   * @default false
   */
  transparent?: boolean;
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
 * Authoring form of `BlockDefinition`, accepted by `BlockRegistry.register()`
 * and the engine's `blocks` option. Tile refs may be given as bare `[col, row]`
 * tuples, and `defaultTilesetId` fills in any ref that omits a tileset.
 * `register()` normalises both away and stores a plain `BlockDefinition`.
 */
export interface BlockDefinitionIn extends BlockDef, BlockDefTextures<TileRefIn> {
  /** Fallback tile set id used for any tile ref that does not have a tileset id.*/
  defaultTilesetId?: string;
}
