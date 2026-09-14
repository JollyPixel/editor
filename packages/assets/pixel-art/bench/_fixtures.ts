// Import Internal Dependencies
import type {
  RGBA8,
  Vec2
} from "../src/types.ts";

export function randomColor(
  rng: () => number
): RGBA8 {
  return {
    r: Math.floor(rng() * 256),
    g: Math.floor(rng() * 256),
    b: Math.floor(rng() * 256),
    a: 255
  };
}

/**
 * Generates `count` in-bounds positions for `size`.
 * Duplicates are intentional to mimic brush revisits.
 */
export function randomPositions(
  count: number,
  size: Vec2,
  rng: () => number
): Vec2[] {
  const positions: Vec2[] = new Array(count);

  for (let i = 0; i < count; i++) {
    positions[i] = {
      x: Math.floor(rng() * size.x),
      y: Math.floor(rng() * size.y)
    };
  }

  return positions;
}
