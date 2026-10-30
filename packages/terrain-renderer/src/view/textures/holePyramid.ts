// Import Internal Dependencies
import {
  chunkResolution,
  type ChunkTier
} from "../../terrain/chunkTier.ts";
import type { HoleMask } from "../../terrain/HoleMask.ts";

// CONSTANTS
const kHole = 255;

export interface HolePyramidSize {
  readonly quads: number;
  readonly width: number;
  readonly height: number;
  readonly texels: number;
  readonly levels: number;
}

export function holePyramidSize(
  tier: ChunkTier
): HolePyramidSize {
  const quads = chunkResolution(tier);

  return {
    quads,
    width: quads * 2,
    height: quads,
    texels: quads * quads * 2,
    levels: Math.log2(quads) + 1
  };
}

export const HOLE_PYRAMID_WIDTH = holePyramidSize(1).width;
export const HOLE_PYRAMID_HEIGHT = holePyramidSize(1).height;
export const HOLE_PYRAMID_TEXELS = holePyramidSize(1).texels;
export const HOLE_PYRAMID_LEVELS = holePyramidSize(1).levels;

export function holeLevelOffset(
  level: number,
  width = HOLE_PYRAMID_WIDTH
): number {
  return width - width / 2 ** level;
}

export function writeHolePyramid(
  holes: Pick<HoleMask, "isHole">,
  target: Uint8Array,
  tier: ChunkTier = 1
): void {
  const { quads, width, levels } = holePyramidSize(tier);
  for (let quadZ = 0; quadZ < quads; quadZ++) {
    for (let quadX = 0; quadX < quads; quadX++) {
      target[quadZ * width + quadX] = holes.isHole(quadX, quadZ) ? kHole : 0;
    }
  }

  for (let level = 1; level < levels; level++) {
    const size = quads >> level;
    const offset = holeLevelOffset(level, width);
    const below = holeLevelOffset(level - 1, width);
    for (let cellZ = 0; cellZ < size; cellZ++) {
      for (let cellX = 0; cellX < size; cellX++) {
        const finer = (cellZ * 2) * width + below + cellX * 2;
        target[cellZ * width + offset + cellX] = Math.max(
          target[finer],
          target[finer + 1],
          target[finer + width],
          target[finer + width + 1]
        );
      }
    }
  }
}
