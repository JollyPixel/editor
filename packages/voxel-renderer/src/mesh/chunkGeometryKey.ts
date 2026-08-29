// CONSTANTS
const kCutoutSuffix = ":cutout";

export interface ChunkGeometryKey {
  tilesetId: string;
  /**
   * Separates transparent faces for a double-sided material.
   */
  cutout: boolean;
}

/**
 * Encodes cutout mode; tileset IDs must not end in `":cutout"`.
 */
export function chunkGeometryKey(
  tilesetId: string,
  cutout: boolean
): string {
  return cutout ? tilesetId + kCutoutSuffix : tilesetId;
}

export function parseChunkGeometryKey(
  key: string
): ChunkGeometryKey {
  return key.endsWith(kCutoutSuffix) ?
    { tilesetId: key.slice(0, -kCutoutSuffix.length), cutout: true } :
    { tilesetId: key, cutout: false };
}
