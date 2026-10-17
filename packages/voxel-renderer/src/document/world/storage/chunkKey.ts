// CONSTANTS
const kChunkBitsY = 10;
const kChunkBitsXZ = 11;
const kChunkSpanY = 1 << kChunkBitsY;
const kChunkSpanXZ = 1 << kChunkBitsXZ;

export const CHUNK_BIAS_Y = 1 << (kChunkBitsY - 1);
export const CHUNK_BIAS_XZ = 1 << (kChunkBitsXZ - 1);

export function packChunkKey(
  cx: number,
  cy: number,
  cz: number
): number {
  return ((cx + CHUNK_BIAS_XZ) << (kChunkBitsY + kChunkBitsXZ)) |
    ((cy + CHUNK_BIAS_Y) << kChunkBitsXZ) |
    (cz + CHUNK_BIAS_XZ);
}

export function inChunkRange(
  cx: number,
  cy: number,
  cz: number
): boolean {
  return (cx + CHUNK_BIAS_XZ) >>> 0 < kChunkSpanXZ &&
    (cy + CHUNK_BIAS_Y) >>> 0 < kChunkSpanY &&
    (cz + CHUNK_BIAS_XZ) >>> 0 < kChunkSpanXZ;
}
