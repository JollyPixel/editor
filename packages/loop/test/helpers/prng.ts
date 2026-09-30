export class Xorshift32 {
  #state: number;

  constructor(
    seed: number
  ) {
    this.#state = (seed | 0) === 0 ? 0x9e3779b9 : seed | 0;
  }

  nextUint32(): number {
    let x = this.#state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.#state = x | 0;

    return x >>> 0;
  }

  nextFloat(): number {
    return this.nextUint32() / 0x100000000;
  }

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
  spikeChance?: number;
  maxSpike?: number;
}

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
      return rng.between(
        maxDelta,
        maxSpike
      );
    }

    return rng.between(
      minDelta,
      maxDelta
    );
  });
}
