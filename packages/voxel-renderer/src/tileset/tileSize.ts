// CONSTANTS
export const MAX_TILE_SIZE = 4096;
export const DEFAULT_TILE_SIZE = 32;

export function isTileSize(
  value: unknown
): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_TILE_SIZE;
}
