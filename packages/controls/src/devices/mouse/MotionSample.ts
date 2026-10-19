// Import Internal Dependencies
import type { Accumulator } from "../ReaderBuffer.ts";

export class MotionSample<
  TSource = never
> implements Accumulator<MotionSample<TSource>> {
  x = 0;
  y = 0;
  source: TSource | null = null;

  get empty(): boolean {
    return this.x === 0 &&
      this.y === 0 &&
      this.source === null;
  }

  add(
    x: number,
    y: number,
    source: TSource | null = null
  ): void {
    this.x += x;
    this.y += y;
    if (
      source !== null &&
      (x !== 0 || y !== 0)
    ) {
      this.source = source;
    }
  }

  addTo(
    target: MotionSample<TSource>
  ): void {
    target.add(this.x, this.y, this.source);
  }

  clear(): void {
    this.x = 0;
    this.y = 0;
    this.source = null;
  }
}
