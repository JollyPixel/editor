// Import Internal Dependencies
import { resolveTileRef } from "../blocksets/tileRef.ts";
import type {
  ResolvedTileRef,
  TileRef
} from "../blocksets/types.ts";
import {
  slotKeyOf,
  type TextureSlotKey
} from "./shape/shapeSlots.ts";
import type { BlockShapeID } from "./shape/BlockShape.ts";
import {
  BlockSurface,
  type BlockSurfaceOptions
} from "./BlockSurface.ts";

export type BlockProperties = Record<
  string,
  string | number | boolean
>;

export interface BlockDefinition extends BlockSurfaceOptions {
  id: number;
  name: string;
  shapeId: BlockShapeID;
  /**
   * Tiles per texture slot; missing slots fall back to their base slot, then
   * to `defaultTexture`. A numeric `FACE` key is read as that face's default
   * slot, so documents written before slots keep loading.
   * @default {}
   */
  faceTextures?: Partial<Record<TextureSlotKey, TileRef>>;
  defaultTexture?: TileRef;
  /**
   * If false, the mesh builder will not emit collision geometry for this block.
   * @default true
   */
  collidable?: boolean;
  /**
   * Whether faces covered by a neighbouring block are removed.
   * @default true for opaque blocks, false otherwise
   */
  cullCoveredFaces?: boolean;
  /**
   * Blend group whose rules fade this block's top and bottom faces into
   * neighbouring blocks of other groups. Ungrouped blocks never blend.
   */
  blendGroup?: string;
  /**
   * Blockset used by tile references that omit one; dropped once resolved.
   */
  defaultBlocksetId?: string;
  properties?: BlockProperties;
}

export type ResolvedBlockDefinition =
  & Omit<
    BlockDefinition,
    | "faceTextures"
    | "defaultTexture"
    | "collidable"
    | "defaultBlocksetId"
    | "properties"
  >
  & {
    faceTextures: Record<string, ResolvedTileRef>;
    defaultTexture?: ResolvedTileRef;
    collidable: boolean;
    properties: BlockProperties;
  };

export function cullsCoveredFaces(
  def: Pick<BlockDefinition, "alphaMode" | "cullCoveredFaces">
): boolean {
  return def.cullCoveredFaces ?? (def.alphaMode ?? "opaque") === "opaque";
}

export function resolveBlockProperties(
  properties: BlockProperties = {}
): BlockProperties {
  const resolved: BlockProperties = {};

  for (const key of Object.keys(properties)) {
    if (key === "__proto__") {
      continue;
    }

    const value = properties[key];
    if (
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      resolved[key] = value;
    }
  }

  return resolved;
}

export function resolveBlockDefinition(
  def: BlockDefinition
): ResolvedBlockDefinition {
  // Validate policy at the registry boundary, including imported documents.
  new BlockSurface(def);
  if (
    def.blendGroup !== undefined &&
    (typeof def.blendGroup !== "string" || def.blendGroup === "")
  ) {
    throw new RangeError("Blend group must be a non-empty string.");
  }
  const {
    faceTextures = {},
    defaultTexture,
    collidable = true,
    defaultBlocksetId,
    properties,
    ...rest
  } = def;

  const resolved: ResolvedBlockDefinition = {
    ...rest,
    collidable,
    faceTextures: {},
    properties: resolveBlockProperties(properties)
  };

  for (const key of Object.keys(faceTextures)) {
    const ref = faceTextures[key];
    if (ref) {
      resolved.faceTextures[slotKeyOf(key)] = resolveTileRef(
        ref,
        defaultBlocksetId
      );
    }
  }

  if (defaultTexture) {
    resolved.defaultTexture = resolveTileRef(
      defaultTexture,
      defaultBlocksetId
    );
  }

  return resolved;
}
