// Import Internal Dependencies
import type {
  TileRef,
  TileRefIn
} from "../tileset/types.ts";
import type { FACE } from "../utils/math.ts";
import type { BlockShapeID } from "./BlockShape.ts";

export interface BlockDef {
  /**
   * Numeric ID; 0 is reserved for air.
   */
  id: number;
  name: string;
  shapeId: BlockShapeID;
  /**
   * A transparent block never hides a neighbouring face.
   * @default false
   */
  transparent?: boolean;
}

export interface BlockDefinition extends BlockDef {
  /**
   * Per-face tiles; missing faces use `defaultTexture`.
   */
  faceTextures: Partial<Record<FACE, TileRef>>;
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
   * Tileset used by tile references that omit one.
   */
  defaultTilesetId?: string;
}
