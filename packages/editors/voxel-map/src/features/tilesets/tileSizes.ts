// Import Third-party Dependencies
import type { JollyOption } from "@jolly-pixel/ui";

// CONSTANTS
export const TILE_SIZES: readonly number[] = [8, 16, 32, 64, 128, 256];

export function tileSizeOptions(
  current?: number
): JollyOption<number>[] {
  const sizes = current === undefined || TILE_SIZES.includes(current) ?
    TILE_SIZES :
    [...TILE_SIZES, current].sort((left, right) => left - right);

  return sizes.map((size) => {
    return {
      label: `${size}px`,
      value: size
    };
  });
}
