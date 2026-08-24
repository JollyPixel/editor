/**
 * monotonic wall-clock time in milliseconds.
 */
export interface Clock {
  now(): number;
}

export class PerformanceClock implements Clock {
  now(): number {
    return performance.now();
  }
}

/**
 * Advances only through `set()` or `advance()`.
 */
export class ManualClock implements Clock {
  #time: number;

  constructor(
    initialTime = 0
  ) {
    this.#time = initialTime;
  }

  now(): number {
    return this.#time;
  }

  set(
    time: number
  ): number {
    this.#time = time;

    return this.#time;
  }

  advance(
    deltaMs: number
  ): number {
    this.#time += deltaMs;

    return this.#time;
  }
}
