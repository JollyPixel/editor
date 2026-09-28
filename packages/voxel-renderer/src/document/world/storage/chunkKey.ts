/*
 * CONSTANTS
 * Chunk coordinates are packed into a single int32 so the chunk map keeps
 * Smi keys: 11 bits for X and Z, 10 for Y, since voxel worlds are far wider
 * than they are tall. Creating a chunk outside that range throws rather than
 * aliasing onto another one.
 */
const kChunkBitsY = 10;
const kChunkBitsXZ = 11;
const kChunkSpanY = 1 << kChunkBitsY;
const kChunkSpanXZ = 1 << kChunkBitsXZ;

export const CHUNK_BIAS_Y = 1 << (kChunkBitsY - 1);
export const CHUNK_BIAS_XZ = 1 << (kChunkBitsXZ - 1);

/**
 * Packs validated chunk coordinates into disjoint biased int32 fields.
 */
export function packChunkKey(
  cx: number,
  cy: number,
  cz: number
): number {
  return ((cx + CHUNK_BIAS_XZ) << (kChunkBitsY + kChunkBitsXZ)) |
    ((cy + CHUNK_BIAS_Y) << kChunkBitsXZ) |
    (cz + CHUNK_BIAS_XZ);
}

/** Unsigned compares catch both ends of each range in one test. */
export function inChunkRange(
  cx: number,
  cy: number,
  cz: number
): boolean {
  return (cx + CHUNK_BIAS_XZ) >>> 0 < kChunkSpanXZ &&
    (cy + CHUNK_BIAS_Y) >>> 0 < kChunkSpanY &&
    (cz + CHUNK_BIAS_XZ) >>> 0 < kChunkSpanXZ;
}
