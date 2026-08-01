// Import Third-party Dependencies
import { createNoise2D as createSimplexNoise2D } from "simplex-noise";

export type Noise2D = (x: number, y: number) => number;

export interface FractalNoiseOptions {
  /**
   * Number of summed noise layers. Each one doubles the detail and halves the
   * contribution (with the default lacunarity/persistence).
   * @default 4
   */
  octaves?: number;
  /**
   * Frequency of the first octave.
   * @default 1
   */
  frequency?: number;
  /**
   * Frequency multiplier between octaves.
   * @default 2
   */
  lacunarity?: number;
  /**
   * Amplitude multiplier between octaves.
   * @default 0.5
   */
  persistence?: number;
}

/**
 * mulberry32 — a 32-bit PRNG. Fast, seedable and stable across runs, which is
 * all a deterministic world generator needs.
 */
export function createRandom(
  seed: number
): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded 2D simplex noise, in `[-1, 1]`. `simplex-noise` ships no PRNG on
 * purpose, so the seed is turned into one here — same seed, same world.
 */
export function createNoise2D(
  seed: number
): Noise2D {
  return createSimplexNoise2D(createRandom(seed));
}

/**
 * Stateless hash of an integer coordinate pair, in `[0, 1)`.
 * Used for per-column decisions (tree placement) where advancing a PRNG in
 * column order would be wasteful.
 */
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

/**
 * Seeded fractal Brownian motion: several octaves of simplex noise summed and
 * normalised back to `[-1, 1]` by their total amplitude. One octave carves the
 * hills, the next ones add the roughness.
 */
export function createFractalNoise2D(
  seed: number,
  options: FractalNoiseOptions = {}
): Noise2D {
  const {
    octaves = 4,
    frequency = 1,
    lacunarity = 2,
    persistence = 0.5
  } = options;

  const noise = createNoise2D(seed);

  // Amplitude sum of every octave, used to normalise the result back to [-1, 1].
  let total = 0;
  let octaveAmplitude = 1;
  for (let octave = 0; octave < octaves; octave++) {
    total += octaveAmplitude;
    octaveAmplitude *= persistence;
  }

  return (x, y) => {
    let value = 0;
    let amplitude = 1;
    let freq = frequency;

    for (let octave = 0; octave < octaves; octave++) {
      value += noise(x * freq, y * freq) * amplitude;
      amplitude *= persistence;
      freq *= lacunarity;
    }

    return total === 0 ? 0 : value / total;
  };
}
