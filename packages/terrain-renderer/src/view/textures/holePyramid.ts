// Import Internal Dependencies
import {
  HOLE_QUADS,
  type HoleMask
} from "../../terrain/HoleMask.ts";

// CONSTANTS
export const HOLE_PYRAMID_WIDTH = HOLE_QUADS * 2;
export const HOLE_PYRAMID_HEIGHT = HOLE_QUADS;
export const HOLE_PYRAMID_TEXELS = HOLE_PYRAMID_WIDTH * HOLE_PYRAMID_HEIGHT;
export const HOLE_PYRAMID_LEVELS = Math.log2(HOLE_QUADS) + 1;
const kHole = 255;

export function holeLevelOffset(
  level: number
): number {
  return HOLE_PYRAMID_WIDTH - HOLE_PYRAMID_WIDTH / 2 ** level;
}

export function writeHolePyramid(
  holes: Pick<HoleMask, "isHole">,
  target: Uint8Array
): void {
  for (let quadZ = 0; quadZ < HOLE_QUADS; quadZ++) {
    for (let quadX = 0; quadX < HOLE_QUADS; quadX++) {
      target[quadZ * HOLE_PYRAMID_WIDTH + quadX] = holes.isHole(quadX, quadZ) ? kHole : 0;
    }
  }

  for (let level = 1; level < HOLE_PYRAMID_LEVELS; level++) {
    const size = HOLE_QUADS >> level;
    const offset = holeLevelOffset(level);
    const below = holeLevelOffset(level - 1);
    for (let cellZ = 0; cellZ < size; cellZ++) {
      for (let cellX = 0; cellX < size; cellX++) {
        const finer = (cellZ * 2) * HOLE_PYRAMID_WIDTH + below + cellX * 2;
        target[cellZ * HOLE_PYRAMID_WIDTH + offset + cellX] = Math.max(
          target[finer],
          target[finer + 1],
          target[finer + HOLE_PYRAMID_WIDTH],
          target[finer + HOLE_PYRAMID_WIDTH + 1]
        );
      }
    }
  }
}
