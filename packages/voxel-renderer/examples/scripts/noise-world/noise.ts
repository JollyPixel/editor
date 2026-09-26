// Import Third-party Dependencies
import { simplex2d } from "math/noise";

// CONSTANTS
const kOffsetRange = 4096;

export interface NoiseLayer {
  sample(x: number, y: number): number;
}

export function createNoiseLayer(
  seed: number,
  salt: number
): NoiseLayer {
  const generator = simplex2d.create(
    Math.floor(hash2D(salt, 0, seed) * 65536)
  );
  const offsetX = hash2D(salt, 1, seed) * kOffsetRange;
  const offsetY = hash2D(salt, 2, seed) * kOffsetRange;

  return {
    sample: (x, y) => simplex2d.sample(generator, x + offsetX, y + offsetY)
  };
}

export function hash2D(
  x: number,
  y: number,
  seed = 0
): number {
  let h = Math.imul(x, 0x27D4EB2D) ^ Math.imul(y, 0x165667B1) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 15), 0x85EBCA6B);
  h ^= h >>> 13;

  return (h >>> 0) / 4294967296;
}
