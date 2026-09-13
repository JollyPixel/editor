// Import Internal Dependencies
import { clamp } from "./bounds.ts";
import {
  precisionOf,
  roundToPrecision
} from "./precision.ts";

export interface ValueFromDeltaOptions {
  /**
   * Value at drag start.
   */
  start: number;
  /**
   * Pointer travel along the scrub axis.
   */
  deltaPx: number;
  step: number;
  /**
   * Pixels per step. @default 4
   */
  pixelsPerStep?: number;
  /**
   * Fine or coarse modifier scale. @default 1
   */
  multiplier?: number;
  min?: number;
  max?: number;
}

/**
 * Returns a scrub value stepped from the drag start.
 */
export function valueFromDelta(
  options: ValueFromDeltaOptions
): number {
  const {
    start,
    deltaPx,
    step,
    pixelsPerStep = 4,
    multiplier = 1,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY
  } = options;

  const stepCount = Math.round(
    (deltaPx / pixelsPerStep) * multiplier
  );
  const raw = start + (stepCount * step);

  return clamp(
    roundToPrecision(raw, precisionOf(start, step)),
    min,
    max
  );
}

