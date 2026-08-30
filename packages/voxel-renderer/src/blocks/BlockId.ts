// CONSTANTS
/**
 * RESERVED ID
 * A cell holding air holds no voxel at all, so it is never registered as a block nor stored in a chunk.
 */
export const AIR_BLOCK_ID = 0;

export function isAir(
  blockId: number
): boolean {
  return blockId === AIR_BLOCK_ID;
}
