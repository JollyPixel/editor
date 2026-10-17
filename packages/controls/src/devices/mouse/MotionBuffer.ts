// Import Internal Dependencies
import type { InputReader } from "../../types.ts";

export interface MotionSample<TSource> {
  x: number;
  y: number;
  source: TSource | null;
}

function emptySample<TSource>(): MotionSample<TSource> {
  return {
    x: 0,
    y: 0,
    source: null
  };
}

export class MotionBuffer<TSource = never> {
  readonly value = emptySample<TSource>();

  #step = emptySample<TSource>();
  #frame = emptySample<TSource>();

  push(
    x: number,
    y: number,
    source: TSource | null = null
  ): void {
    this.#step.x += x;
    this.#step.y += y;
    this.#frame.x += x;
    this.#frame.y += y;
    if (source !== null && (x !== 0 || y !== 0)) {
      this.#step.source = source;
      this.#frame.source = source;
    }
  }

  take(
    reader: InputReader
  ): void {
    const sum = reader === "step" ? this.#step : this.#frame;
    this.value.x = sum.x;
    this.value.y = sum.y;
    this.value.source = sum.source;
    sum.x = 0;
    sum.y = 0;
    sum.source = null;
  }

  reset(): void {
    for (const sample of [this.value, this.#step, this.#frame]) {
      sample.x = 0;
      sample.y = 0;
      sample.source = null;
    }
  }
}
