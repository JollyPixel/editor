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

export function powerOfTwoTileSizes(
  min = 1,
  max = MAX_TILE_SIZE
): number[] {
  const sizes: number[] = [];
  for (let size = 1; size <= Math.min(max, MAX_TILE_SIZE); size *= 2) {
    if (size >= min) {
      sizes.push(size);
    }
  }

  return sizes;
}
