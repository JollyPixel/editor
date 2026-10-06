// Import Internal Dependencies
import type { BlockSurface } from "../../../document/blocks/BlockSurface.ts";
import type { BlendGroup } from "../../../document/materials/BlendGroup.ts";
import type {
  ResolvedBlocksetDefinition,
  TileRotation,
  TileSpan,
  AtlasUVRegion
} from "../../../document/blocksets/types.ts";

export interface AtlasUvSource {
  readonly def: ResolvedBlocksetDefinition;
  uvFor(
    col: number,
    row: number,
    size?: number,
    span?: Readonly<TileSpan>,
    rotation?: TileRotation
  ): AtlasUVRegion;
}

export interface BlocksetResolver {
  readonly version: number;
  resolve(
    blocksetId?: string
  ): AtlasUvSource | undefined;
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
   * Unsigned-normalized UVs inside the tile; `region` maps them to the atlas.
   */
  uvs: Uint16Array;
  /**
   * Unsigned-normalized `[offsetU, offsetV, scaleU, scaleV]` atlas rect.
   */
  region: Uint16Array;
  /**
   * Row of the block texture slot in the face region table, which holds
   * `region` for the shader so a tile move needs no remesh.
   */
  regionId: number;
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
  /**
   * The block's blend group, or null when it is ungrouped, names an unknown
   * group, or is not opaque.
   */
  blend: BlendGroup | null;
}

export interface MergedVariantPart {
  variant: BlockVariant;
  /**
   * The part's faces minus the inner ones the other part hides.
   */
  faces: readonly BlockVariantFace[];
}

/**
 * The two shapes of a merged cell.
 */
export interface MergedVariant {
  parts: readonly MergedVariantPart[];
  /**
   * Stands for the whole cell in neighbour, occlusion and coverage queries.
   */
  occluder: BlockVariant;
}
