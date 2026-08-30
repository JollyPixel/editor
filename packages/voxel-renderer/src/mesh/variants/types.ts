/**
 * World-axis mapping for a full quad that greedy meshing can stretch.
 */
export interface BlockFaceMerge {
  /** World axis the face is perpendicular to (0 = x, 1 = y, 2 = z). */
  axis: number;
  uAxis: number;
  vAxis: number;
  /**
   * True when tile U follows `vAxis` after rotation or mirroring.
   */
  swapped: boolean;
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
   * Unsigned-normalized atlas UVs emitted by the non-tiled path.
   */
  uvs: Uint16Array;
  /**
   * Float tile-space UVs that greedy quads scale beyond 1 for repetition.
   */
  tileUvs: Float32Array;
  /**
   * Unsigned-normalized `[offsetU, offsetV, scaleU, scaleV]` atlas rect.
   */
  region: Uint16Array;
  merge: BlockFaceMerge | null;
  /** Face normal, signed-normalized to the byte the attribute is emitted as. */
  normalX: number;
  normalY: number;
  normalZ: number;
}

export interface BlockVariant {
  faces: readonly BlockVariantFace[];
  /** Bit `f` is set when this variant fully covers world-space face `f`. */
  occlusionMask: number;
  /**
   * Mergeable full-quad face for each world-space direction.
   */
  mergeFaces: readonly (BlockVariantFace | undefined)[];
  /**
   * Per-mesher scratch index valid only while `sweepEpoch` matches.
   */
  sweepIndex: number;
  sweepEpoch: number;
}
