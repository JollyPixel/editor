// Import Internal Dependencies
import { type Clock, PerformanceClock } from "./Clock.ts";

/**
 * Tracks a millisecond deadline for optional per-frame work.
 */
export class FrameBudget {
  #clock: Clock;
  #budget = 0;
  #startedAt = 0;
  #deadline = -Infinity;

  constructor(
    clock: Clock = new PerformanceClock()
  ) {
    this.#clock = clock;
  }

  get budget(): number {
    return this.#budget;
  }

  get elapsed(): number {
    return this.#deadline === -Infinity ?
      0 :
      this.#clock.now() - this.#startedAt;
  }

  get remaining(): number {
    return Math.max(this.#deadline - this.#clock.now(), 0);
  }

  get expired(): boolean {
    return this.#clock.now() >= this.#deadline;
  }

  start(
    budgetMs: number
  ): this {
    if (!Number.isFinite(budgetMs) || budgetMs < 0) {
      throw new RangeError(
        `budgetMs must be a finite number >= 0, got ${budgetMs}`
      );
    }
    this.#budget = budgetMs;
    this.#startedAt = this.#clock.now();
    this.#deadline = this.#startedAt + budgetMs;

    return this;
  }

  clear(): this {
    this.#budget = 0;
    this.#startedAt = 0;
    this.#deadline = -Infinity;

    return this;
  }
}
