// Import Internal Dependencies
import {
  resolveTileRef,
  type ResolvedTileRef,
  type TileRef
} from "../tileset/types.ts";
import {
  FACES,
  type FACE
} from "../utils/math.ts";
import {
  baseSlotOf,
  slotNameOf
} from "./shape/shapeSlots.ts";
import type { BlockShapeID } from "./shape/BlockShape.ts";

export interface BlockDefinition {
  id: number;
  name: string;
  shapeId: BlockShapeID;
  /**
   * Tiles per texture slot; missing slots fall back to their base slot, then
   * to `defaultTexture`. A numeric `FACE` key is read as that face's default
   * slot, so documents written before slots keep loading.
   * @default {}
   */
  faceTextures?: Record<string, TileRef>;
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
    faceTextures: Record<string, ResolvedTileRef>;
    defaultTexture?: ResolvedTileRef;
    collidable: boolean;
  };

/**
 * Reads a legacy numeric `FACE` key as that face's default slot.
 */
export function slotKeyOf(
  key: string
): string {
  const face = Number(key);

  return Number.isInteger(face) && face >= 0 && face < FACES.length ?
    slotNameOf(face as FACE) :
    key;
}

/**
 * Tile a slot samples, falling back to its base slot then to the block's
 * default. Returns undefined when the block has no usable tile at all.
 */
export function tileRefForSlot(
  block: ResolvedBlockDefinition,
  slot: string
): ResolvedTileRef | undefined {
  return block.faceTextures[slot] ??
    block.faceTextures[baseSlotOf(slot)] ??
    block.defaultTexture;
}

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
    const ref = faceTextures[key];
    if (ref) {
      resolved.faceTextures[slotKeyOf(key)] = resolveTileRef(
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
