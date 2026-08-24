/**
 * Seeded xorshift32 for deterministic generated tapes.
 */
export class Xorshift32 {
  #state: number;

  constructor(
    seed: number
  ) {
    // A zero state is a fixed point of xorshift, so it is remapped.
    this.#state = (seed | 0) === 0 ? 0x9e3779b9 : seed | 0;
  }

  /**
   * Returns the next unsigned 32-bit integer.
   */
  nextUint32(): number {
    let x = this.#state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.#state = x | 0;

    return x >>> 0;
  }

  /**
   * Returns the next float in `[0, 1)`.
   */
  nextFloat(): number {
    return this.nextUint32() / 0x100000000;
  }

  /**
   * Returns the next float in `[min, max)`.
   */
  between(
    min: number,
    max: number
  ): number {
    return min + (this.nextFloat() * (max - min));
  }
}

export interface GeneratedTapeOptions {
  frames?: number;
  minDelta?: number;
  maxDelta?: number;
  /**
   * Probability of replacing a frame with a long stall.
   */
  spikeChance?: number;
  maxSpike?: number;
}

/**
 * Generates frame deltas with occasional long stalls.
 */
export function generateTape(
  rng: Xorshift32,
  options: GeneratedTapeOptions = {}
): number[] {
  const {
    frames = 200,
    minDelta = 0,
    maxDelta = 40,
    spikeChance = 0.05,
    maxSpike = 8000
  } = options;

  return Array.from({ length: frames }, () => {
    if (rng.nextFloat() < spikeChance) {
      return rng.between(maxDelta, maxSpike);
    }

    return rng.between(minDelta, maxDelta);
  });
}
