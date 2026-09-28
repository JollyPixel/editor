// Import Internal Dependencies
import type { BlockSurface } from "../../../document/blocks/BlockSurface.ts";
import type {
  ResolvedTilesetDefinition,
  TileRotation,
  TileSpan,
  TilesetUVRegion
} from "../../../document/tilesets/types.ts";

export interface TilesetUvSource {
  readonly def: ResolvedTilesetDefinition;
  uvFor(
    col: number,
    row: number,
    size?: number,
    span?: Readonly<TileSpan>,
    rotation?: TileRotation
  ): TilesetUVRegion;
}

export interface TilesetResolver {
  readonly version: number;
  resolve(
    tilesetId?: string
  ): TilesetUvSource | undefined;
}

/**
 * Polygon with transforms, winding, and atlas UVs compiled into its data.
 */
export interface BlockVariantFace {
  /** World-space neighbour direction to test for occlusion, or -1 to always emit. */
  cull: number;
  slot: number;
  vertexCount: number;
  indexCount: number;
  /** `vertexCount × 3` block-local positions in 0-1 space. */
  positions: Float32Array;
  /**
   * Unsigned-normalized atlas UVs.
   */
  uvs: Uint16Array;
  /**
   * Unsigned-normalized `[offsetU, offsetV, scaleU, scaleV]` atlas rect.
   */
  region: Uint16Array;
  full: boolean;
  /**
   * True when a neighbour's footprint may split this boundary face.
   */
  splittable: boolean;
  /** Face normal, signed-normalized to the byte the attribute is emitted as. */
  normalX: number;
  normalY: number;
  normalZ: number;
}

export interface BlockVariant {
  surface: BlockSurface;
  /** Block this variant was compiled from, for same-block face culling. */
  blockId: number;
  faces: readonly BlockVariantFace[];
  /**
   * Bit `f` is set when this variant fully covers world-space face `f`,
   * and always 0 for a cutout block: alpha holes mean it may never hide the
   * face of a different block.
   */
  occlusionMask: number;
  /**
   * What `occlusionMask` would be without the cutout rule, consulted only
   * against a neighbour holding the same block. Two adjacent leaves drop
   * their shared face; leaves still hide nothing of the stone beside them.
   */
  selfOcclusionMask: number;
  keepsCoveredFaces: boolean;
}
