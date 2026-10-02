// Import Internal Dependencies
import type { InputReader } from "../types.ts";

/**
 * Edge bits observed once and kept for both readers until each takes them.
 */
export class EdgeBuffer {
  #step = 0;
  #frame = 0;

  push(
    bits: number
  ): void {
    this.#step |= bits;
    this.#frame |= bits;
  }

  take(
    reader: InputReader
  ): number {
    if (reader === "step") {
      const bits = this.#step;
      this.#step = 0;

      return bits;
    }

    const bits = this.#frame;
    this.#frame = 0;

    return bits;
  }

  reset(): void {
    this.#step = 0;
    this.#frame = 0;
  }
}
