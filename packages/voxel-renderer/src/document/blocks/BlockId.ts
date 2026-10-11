// CONSTANTS
/**
 * RESERVED ID
 * A cell holding air holds no voxel at all, so it is never registered as a block nor stored in a chunk.
 */
export const AIR_BLOCK_ID = 0;

/**
 * A block id is a blockset slot in the high bits and the block's id inside
 * that blockset in the low 16 bits. Slot 0 keeps the local id unchanged.
 */
export const LOCAL_BLOCK_ID_BITS = 16;
export const MAX_LOCAL_BLOCK_ID = 0xFFFF;
export const MAX_BLOCKSET_SLOT = 0x7F;

export function isAir(
  blockId: number
): boolean {
  return blockId === AIR_BLOCK_ID;
}

export function isBlocksetSlot(
  value: unknown
): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_BLOCKSET_SLOT;
}

export function isLocalBlockId(
  value: unknown
): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > AIR_BLOCK_ID &&
    value <= MAX_LOCAL_BLOCK_ID;
}

export function composeBlockId(
  slot: number,
  localId: number
): number {
  if (!isBlocksetSlot(slot)) {
    throw new RangeError(
      `Blockset slot ${slot} is out of range (0..${MAX_BLOCKSET_SLOT}).`
    );
  }
  if (!isLocalBlockId(localId)) {
    throw new RangeError(
      `Block id ${localId} is out of range (1..${MAX_LOCAL_BLOCK_ID}).`
    );
  }

  return (slot << LOCAL_BLOCK_ID_BITS) | localId;
}

export function decodeBlocksetSlot(
  blockId: number
): number {
  return blockId >>> LOCAL_BLOCK_ID_BITS;
}

export function decodeLocalBlockId(
  blockId: number
): number {
  return blockId & MAX_LOCAL_BLOCK_ID;
}
