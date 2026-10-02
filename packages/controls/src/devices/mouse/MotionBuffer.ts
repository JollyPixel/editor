// Import Internal Dependencies
import type { InputReader } from "../../types.ts";

/**
 * Movement summed for both readers until each takes it into `value`.
 */
export class MotionBuffer {
  readonly value = {
    x: 0,
    y: 0
  };

  #step = {
    x: 0,
    y: 0
  };
  #frame = {
    x: 0,
    y: 0
  };

  push(
    x: number,
    y: number
  ): void {
    this.#step.x += x;
    this.#step.y += y;
    this.#frame.x += x;
    this.#frame.y += y;
  }

  take(
    reader: InputReader
  ): void {
    const sum = reader === "step" ? this.#step : this.#frame;
    this.value.x = sum.x;
    this.value.y = sum.y;
    sum.x = 0;
    sum.y = 0;
  }

  reset(): void {
    this.value.x = 0;
    this.value.y = 0;
    this.#step.x = 0;
    this.#step.y = 0;
    this.#frame.x = 0;
    this.#frame.y = 0;
  }
}
