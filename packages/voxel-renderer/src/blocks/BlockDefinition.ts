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
  /**
   * Human-readable name for editor display.
   */
  name: string;
  /**
   * ID of the BlockShape to use for geometry generation.
   */
  shapeId: BlockShapeID;
  /**
   * A transparent block never hides a neighbouring face.
   * @default false
   */
  transparent?: boolean;
}

export interface BlockDefinition extends BlockDef {
  /**
   * Per-face tile references. If a face is absent, defaultTexture is used.
   */
  faceTextures: Partial<Record<FACE, TileRef>>;
  /**
   * Fallback tile used for any face not listed in faceTextures.
   */
  defaultTexture?: TileRef;
  /**
   * If false, the mesh builder will not emit collision geometry for this block.
   * @default true
   */
  collidable: boolean;
}

export interface BlockDefinitionIn extends BlockDef {
  /**
   * @default {}
   */
  faceTextures?: Partial<Record<FACE, TileRefIn>>;
  defaultTexture?: TileRefIn;
  /**
   * @default true
   */
  collidable?: boolean;
  /**
   * Fallback tile set id used for any tile ref that does not have a tileset id.
   */
  defaultTilesetId?: string;
}
