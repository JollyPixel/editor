// Import Internal Dependencies
import type { NumberRange } from "./NumberRange.ts";

export class WorldScale {
  #value = 1;

  get value(): number {
    return this.#value;
  }

  set value(
    scale: number
  ) {
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new RangeError(
        `worldScale must be a finite number greater than 0, got ${scale}`
      );
    }

    this.#value = scale;
  }

  length(
    base: number
  ): number {
    return base * this.#value;
  }

  clamp(
    range: NumberRange,
    length: number
  ): number {
    return Math.min(
      this.length(range.max),
      Math.max(this.length(range.min), length)
    );
  }
}
