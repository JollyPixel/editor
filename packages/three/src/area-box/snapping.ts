// Import Internal Dependencies
import type {
  AreaHandleSign,
  AxisExtent,
  AxisRange
} from "./types.ts";

/**
 * Snaps to `step`; invalid or non-positive steps return `value`.
 */
export function snapValue(
  value: number,
  step: number
): number {
  if (!Number.isFinite(step) || step <= 0) {
    return value;
  }

  return Math.round(value / step) * step;
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max);
}

export interface MoveAxisOptions {
  target: number;
  size: number;
  bounds?: AxisRange | null;
}

/**
 * Clamps the min corner; oversized extents pin to `bounds.min`.
 */
export function moveAxis(
  options: MoveAxisOptions
): number {
  const { target, size, bounds } = options;
  if (!bounds) {
    return target;
  }

  const highest = bounds.max - size;
  if (highest < bounds.min) {
    return bounds.min;
  }

  return clamp(target, bounds.min, highest);
}

export interface ResizeAxisOptions {
  min: number;
  size: number;
  sign: AreaHandleSign;
  faceCoord: number;
  minSize: number;
  bounds?: AxisRange | null;
}

/**
 * Resizes one face; `minSize` wins when it conflicts with `bounds`.
 */
export function resizeAxis(
  options: ResizeAxisOptions
): AxisExtent {
  const { min, size, sign, minSize, bounds } = options;
  const max = min + size;

  let faceCoord = options.faceCoord;
  if (bounds) {
    faceCoord = clamp(faceCoord, bounds.min, bounds.max);
  }

  if (sign === 1) {
    const nextMax = Math.max(faceCoord, min + minSize);

    return {
      min,
      size: nextMax - min
    };
  }

  const nextMin = Math.min(faceCoord, max - minSize);

  return {
    min: nextMin,
    size: max - nextMin
  };
}
