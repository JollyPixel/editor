// Import Internal Dependencies
import { clamp } from "./bounds.ts";
import {
  quantize,
  type NumericBounds
} from "./entry.ts";

export interface TrackSpan {
  left: number;
  width: number;
}

export class Track {
  readonly left: number;
  readonly width: number;
  readonly bounds: Readonly<NumericBounds>;

  constructor(
    span: TrackSpan,
    bounds: NumericBounds
  ) {
    this.left = span.left;
    this.width = Math.max(span.width, 0);
    this.bounds = { ...bounds };
  }

  get pixelsPerStep(): number | undefined {
    const { step, min, max } = this.bounds;
    const steps = (max - min) / step;
    if (
      this.width === 0 ||
      !Number.isFinite(steps) ||
      steps <= 0
    ) {
      return undefined;
    }

    return this.width / steps;
  }

  valueAt(
    clientX: number
  ): number | undefined {
    if (this.width === 0) {
      return undefined;
    }

    const { step, min, max } = this.bounds;
    const ratio = clamp((clientX - this.left) / this.width, 0, 1);

    return quantize(
      min + (ratio * (max - min)),
      step,
      min,
      max
    );
  }
}
