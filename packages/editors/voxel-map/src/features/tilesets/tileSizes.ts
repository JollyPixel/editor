// Import Third-party Dependencies
import type { JollyOption } from "@jolly-pixel/ui";

// CONSTANTS
export const TILE_SIZES: readonly number[] = [8, 16, 32, 64, 128, 256];

/**
 * Power-of-two sizes, plus `current` when a tileset uses an off-list size.
 */
export function tileSizes(
  current?: number
): readonly number[] {
  return current === undefined || TILE_SIZES.includes(current) ?
    TILE_SIZES :
    [...TILE_SIZES, current].sort((left, right) => left - right);
}

/**
 * Labels carry no unit, a button group is too narrow for it.
 */
export function tileSizeSegments(
  current?: number
): JollyOption<number>[] {
  return tileSizes(current).map((size) => {
    return {
      label: `${size}`,
      value: size
    };
  });
}
