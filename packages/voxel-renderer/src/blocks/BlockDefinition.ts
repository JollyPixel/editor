// Import Internal Dependencies
import type {
  ResolvedTileRef,
  TileRef
} from "../tileset/types.ts";
import { resolveTileRef } from "../tileset/resolve.ts";
import type { FACE } from "../utils/math.ts";
import type { BlockShapeID } from "./BlockShape.ts";

export interface BlockDefinition {
  /**
   * Numeric ID; 0 is reserved for air.
   */
  id: number;
  name: string;
  shapeId: BlockShapeID;
  /**
   * Per-face tiles; missing faces use `defaultTexture`.
   * @default {}
   */
  faceTextures?: Partial<Record<FACE, TileRef>>;
  defaultTexture?: TileRef;
  /**
   * If false, the mesh builder will not emit collision geometry for this block.
   * @default true
   */
  collidable?: boolean;
  /**
   * A transparent block never hides a neighbouring face.
   * @default false
   */
  transparent?: boolean;
  /**
   * Tileset used by tile references that omit one; dropped once resolved.
   */
  defaultTilesetId?: string;
}

export type ResolvedBlockDefinition =
  & Omit<
    BlockDefinition,
    "faceTextures" | "defaultTexture" | "collidable" | "defaultTilesetId"
  >
  & {
    faceTextures: Partial<Record<FACE, ResolvedTileRef>>;
    defaultTexture?: ResolvedTileRef;
    collidable: boolean;
  };

export function resolveBlockDefinition(
  def: BlockDefinition
): ResolvedBlockDefinition {
  const {
    faceTextures = {},
    defaultTexture,
    collidable = true,
    defaultTilesetId,
    ...rest
  } = def;

  const resolved: ResolvedBlockDefinition = {
    ...rest,
    collidable,
    faceTextures: {}
  };

  for (const key of Object.keys(faceTextures)) {
    const face = Number(key) as FACE;
    const ref = faceTextures[face];
    if (ref) {
      resolved.faceTextures[face] = resolveTileRef(
        ref,
        defaultTilesetId
      );
    }
  }

  if (defaultTexture) {
    resolved.defaultTexture = resolveTileRef(
      defaultTexture,
      defaultTilesetId
    );
  }

  return resolved;
}
