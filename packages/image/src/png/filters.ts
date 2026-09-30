// Import Internal Dependencies
import { InvalidPngError } from "./errors/InvalidPngError.ts";

// CONSTANTS
export const FILTER_TYPES = [
  0,
  1,
  2,
  3,
  4
] as const;

export type FilterType = typeof FILTER_TYPES[number];

export type FilterStrategy = (
  row: Uint8ClampedArray,
  above: Uint8ClampedArray,
  bytesPerPixel: number,
  out: Uint8Array
) => FilterType;

export function filterScanlines(
  samples: Uint8ClampedArray,
  width: number,
  height: number,
  bytesPerPixel: number,
  strategy: FilterStrategy
): Uint8Array<ArrayBuffer> {
  const stride = width * bytesPerPixel;
  const out = new Uint8Array(height * (stride + 1));

  let above: Uint8ClampedArray = new Uint8ClampedArray(stride);
  for (let y = 0; y < height; y++) {
    const row = samples.subarray(y * stride, (y + 1) * stride);
    const to = y * (stride + 1);

    out[to] = strategy(
      row,
      above,
      bytesPerPixel,
      out.subarray(to + 1, to + 1 + stride)
    );
    above = row;
  }

  return out;
}

export function unfilterScanlines(
  raw: Uint8Array,
  width: number,
  height: number,
  bytesPerPixel: number
): Uint8Array {
  const stride = width * bytesPerPixel;
  if (raw.length < height * (stride + 1)) {
    throw new InvalidPngError("the image data is truncated.");
  }

  const out = new Uint8Array(stride * height);
  let above = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const from = y * (stride + 1);
    const filter: FilterType | undefined = FILTER_TYPES[raw[from]];
    if (filter === undefined) {
      throw new InvalidPngError(`unknown scanline filter ${raw[from]}.`);
    }

    const row = out.subarray(y * stride, (y + 1) * stride);
    unfilterRow(
      filter,
      raw.subarray(from + 1, from + 1 + stride),
      above,
      bytesPerPixel,
      row
    );
    above = row;
  }

  return out;
}

export function fixedFilter(
  filter: FilterType
): FilterStrategy {
  return (row, above, bytesPerPixel, out) => {
    filterRow(filter, row, above, bytesPerPixel, out);

    return filter;
  };
}

export function adaptiveFilter(
  row: Uint8ClampedArray,
  above: Uint8ClampedArray,
  bytesPerPixel: number,
  out: Uint8Array
): FilterType {
  let best: FilterType = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < FILTER_TYPES.length; index++) {
    const filter = FILTER_TYPES[index];
    const score = scoreRow(filter, row, above, bytesPerPixel);
    if (score < bestScore) {
      bestScore = score;
      best = filter;
    }
  }
  filterRow(best, row, above, bytesPerPixel, out);

  return best;
}

function filterRow(
  filter: FilterType,
  row: Uint8ClampedArray,
  above: Uint8ClampedArray,
  bytesPerPixel: number,
  out: Uint8Array
): void {
  for (let index = 0; index < row.length; index++) {
    out[index] = residual(filter, row, above, bytesPerPixel, index);
  }
}

function scoreRow(
  filter: FilterType,
  row: Uint8ClampedArray,
  above: Uint8ClampedArray,
  bytesPerPixel: number
): number {
  let sum = 0;
  for (let index = 0; index < row.length; index++) {
    const value = residual(filter, row, above, bytesPerPixel, index);
    sum += value < 128 ? value : 256 - value;
  }

  return sum;
}

function residual(
  filter: FilterType,
  row: Uint8ClampedArray,
  above: Uint8ClampedArray,
  bytesPerPixel: number,
  index: number
): number {
  const hasLeft = index >= bytesPerPixel;

  return (row[index] - predict(
    filter,
    hasLeft ? row[index - bytesPerPixel] : 0,
    above[index],
    hasLeft ? above[index - bytesPerPixel] : 0
  )) & 0xFF;
}

function unfilterRow(
  filter: FilterType,
  raw: Uint8Array,
  above: Uint8Array,
  bytesPerPixel: number,
  out: Uint8Array
): void {
  for (let index = 0; index < raw.length; index++) {
    const hasLeft = index >= bytesPerPixel;

    out[index] = raw[index] + predict(
      filter,
      hasLeft ? out[index - bytesPerPixel] : 0,
      above[index],
      hasLeft ? above[index - bytesPerPixel] : 0
    );
  }
}

function predict(
  filter: FilterType,
  left: number,
  up: number,
  upLeft: number
): number {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return (left + up) >> 1;
    case 4:
      return paeth(left, up, upLeft);
  }
}

function paeth(
  left: number,
  up: number,
  upLeft: number
): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);

  if (
    distanceLeft <= distanceUp &&
    distanceLeft <= distanceUpLeft
  ) {
    return left;
  }

  return distanceUp <= distanceUpLeft ? up : upLeft;
}
