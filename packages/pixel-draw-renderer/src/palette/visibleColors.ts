// Import Internal Dependencies
import type { RGBA8 } from "../types.ts";

// CONSTANTS
const kChannels = 4;

export function visibleColors(
  pixels: ArrayLike<number>,
  limit: number
): RGBA8[] {
  const seen = new Map<number, RGBA8>();
  for (
    let index = 0;
    index < pixels.length && seen.size < limit;
    index += kChannels
  ) {
    const a = pixels[index + 3];
    if (a === 0) {
      continue;
    }

    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const key = (((((r * 256) + g) * 256) + b) * 256) + a;
    if (!seen.has(key)) {
      seen.set(key, {
        r,
        g,
        b,
        a
      });
    }
  }

  return [...seen.values()];
}
