// CONSTANTS
/**
 * RESERVED ID
 * A cell holding air holds no voxel at all, so it is never registered as a block nor stored in a chunk.
 */
export const AIR_BLOCK_ID = 0;

/**
 * A block id is a tileset slot in the high bits and the block's id inside
 * that tileset in the low 16 bits. Slot 0 keeps the local id unchanged.
 */
export const LOCAL_BLOCK_ID_BITS = 16;
export const MAX_LOCAL_BLOCK_ID = 0xFFFF;
export const MAX_TILESET_SLOT = 0x7F;

export function isAir(
  blockId: number
): boolean {
  return blockId === AIR_BLOCK_ID;
}

export function isTilesetSlot(
  value: unknown
): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_TILESET_SLOT;
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
  if (!isTilesetSlot(slot)) {
    throw new RangeError(
      `Tileset slot ${slot} is out of range (0..${MAX_TILESET_SLOT}).`
    );
  }
  if (!isLocalBlockId(localId)) {
    throw new RangeError(
      `Block id ${localId} is out of range (1..${MAX_LOCAL_BLOCK_ID}).`
    );
  }

  return (slot << LOCAL_BLOCK_ID_BITS) | localId;
}

export function tilesetSlotOf(
  blockId: number
): number {
  return blockId >>> LOCAL_BLOCK_ID_BITS;
}

export function localBlockIdOf(
  blockId: number
): number {
  return blockId & MAX_LOCAL_BLOCK_ID;
}
