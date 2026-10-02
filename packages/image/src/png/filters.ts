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
): Uint8Array<ArrayBuffer> {
  const stride = width * bytesPerPixel;
  if (raw.length < height * (stride + 1)) {
    throw new InvalidPngError("the image data is truncated.");
  }

  const out = new Uint8Array(stride * height);
  const words = stride % 4 === 0 ? new Uint32Array(out.buffer) : null;
  const strideWords = stride / 4;
  let above = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const from = y * (stride + 1);
    const filter = raw[from];
    const line = raw.subarray(from + 1, from + 1 + stride);
    const row = out.subarray(y * stride, (y + 1) * stride);

    if (
      words !== null &&
      y > 0 &&
      (filter === 2 || (bytesPerPixel === 4 && (filter === 1 || filter === 3)))
    ) {
      row.set(line);
      unfilterWords(filter, words, y * strideWords, strideWords);
      above = row;
      continue;
    }

    switch (filter) {
      case 0:
        row.set(line);
        break;
      case 1:
        unfilterSub(line, bytesPerPixel, row);
        break;
      case 2:
        unfilterUp(line, above, row);
        break;
      case 3:
        unfilterAverage(line, above, bytesPerPixel, row);
        break;
      case 4:
        unfilterPaeth(line, above, bytesPerPixel, row);
        break;
      default:
        throw new InvalidPngError(`unknown scanline filter ${filter}.`);
    }
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
  let none = 0;
  let up = 0;
  let average = 0;

  for (let index = 0; index < bytesPerPixel; index++) {
    const value = row[index];
    const upValue = above[index];

    none += magnitude(value);
    up += magnitude(value - upValue);
    average += magnitude(value - (upValue >> 1));
  }

  let sub = none;
  let paethScore = up;
  for (let index = bytesPerPixel; index < row.length; index++) {
    const value = row[index];
    const left = row[index - bytesPerPixel];
    const upValue = above[index];
    const upLeft = above[index - bytesPerPixel];

    none += magnitude(value);
    sub += magnitude(value - left);
    up += magnitude(value - upValue);
    average += magnitude(value - ((left + upValue) >> 1));
    paethScore += magnitude(value - paeth(left, upValue, upLeft));
  }

  let best: FilterType = 0;
  let bestScore = none;
  if (sub < bestScore) {
    best = 1;
    bestScore = sub;
  }
  if (up < bestScore) {
    best = 2;
    bestScore = up;
  }
  if (average < bestScore) {
    best = 3;
    bestScore = average;
  }
  if (paethScore < bestScore) {
    best = 4;
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
  switch (filter) {
    case 0:
      out.set(row);
      break;
    case 1:
      filterSub(row, bytesPerPixel, out);
      break;
    case 2:
      filterUp(row, above, out);
      break;
    case 3:
      filterAverage(row, above, bytesPerPixel, out);
      break;
    case 4:
      filterPaeth(row, above, bytesPerPixel, out);
      break;
  }
}

function filterSub(
  row: Uint8ClampedArray,
  bytesPerPixel: number,
  out: Uint8Array
): void {
  for (let index = 0; index < bytesPerPixel; index++) {
    out[index] = row[index];
  }
  for (let index = bytesPerPixel; index < row.length; index++) {
    out[index] = (row[index] - row[index - bytesPerPixel]) & 0xFF;
  }
}

function filterUp(
  row: Uint8ClampedArray,
  above: Uint8ClampedArray,
  out: Uint8Array
): void {
  for (let index = 0; index < row.length; index++) {
    out[index] = (row[index] - above[index]) & 0xFF;
  }
}

function filterAverage(
  row: Uint8ClampedArray,
  above: Uint8ClampedArray,
  bytesPerPixel: number,
  out: Uint8Array
): void {
  for (let index = 0; index < bytesPerPixel; index++) {
    out[index] = (row[index] - (above[index] >> 1)) & 0xFF;
  }
  for (let index = bytesPerPixel; index < row.length; index++) {
    const left = row[index - bytesPerPixel];

    out[index] = (row[index] - ((left + above[index]) >> 1)) & 0xFF;
  }
}

function filterPaeth(
  row: Uint8ClampedArray,
  above: Uint8ClampedArray,
  bytesPerPixel: number,
  out: Uint8Array
): void {
  for (let index = 0; index < bytesPerPixel; index++) {
    out[index] = (row[index] - above[index]) & 0xFF;
  }
  for (let index = bytesPerPixel; index < row.length; index++) {
    out[index] = (row[index] - paeth(
      row[index - bytesPerPixel],
      above[index],
      above[index - bytesPerPixel]
    )) & 0xFF;
  }
}

function unfilterSub(
  raw: Uint8Array,
  bytesPerPixel: number,
  out: Uint8Array
): void {
  for (let index = 0; index < bytesPerPixel; index++) {
    out[index] = raw[index];
  }
  for (let index = bytesPerPixel; index < raw.length; index++) {
    out[index] = (raw[index] + out[index - bytesPerPixel]) & 0xFF;
  }
}

function unfilterUp(
  raw: Uint8Array,
  above: Uint8Array,
  out: Uint8Array
): void {
  for (let index = 0; index < raw.length; index++) {
    out[index] = (raw[index] + above[index]) & 0xFF;
  }
}

function unfilterAverage(
  raw: Uint8Array,
  above: Uint8Array,
  bytesPerPixel: number,
  out: Uint8Array
): void {
  for (let index = 0; index < bytesPerPixel; index++) {
    out[index] = (raw[index] + (above[index] >> 1)) & 0xFF;
  }
  for (let index = bytesPerPixel; index < raw.length; index++) {
    const left = out[index - bytesPerPixel];

    out[index] = (raw[index] + ((left + above[index]) >> 1)) & 0xFF;
  }
}

function unfilterPaeth(
  raw: Uint8Array,
  above: Uint8Array,
  bytesPerPixel: number,
  out: Uint8Array
): void {
  for (let index = 0; index < bytesPerPixel; index++) {
    out[index] = (raw[index] + above[index]) & 0xFF;
  }
  for (let index = bytesPerPixel; index < raw.length; index++) {
    out[index] = (raw[index] + paeth(
      out[index - bytesPerPixel],
      above[index],
      above[index - bytesPerPixel]
    )) & 0xFF;
  }
}

function unfilterWords(
  filter: 1 | 2 | 3,
  words: Uint32Array,
  start: number,
  strideWords: number
): void {
  const end = start + strideWords;

  switch (filter) {
    case 1: {
      let left = words[start];
      for (let index = start + 1; index < end; index++) {
        left = addBytes(words[index], left);
        words[index] = left;
      }
      break;
    }
    case 2:
      for (let index = start; index < end; index++) {
        words[index] = addBytes(words[index], words[index - strideWords]);
      }
      break;
    case 3: {
      let left = addBytes(
        words[start],
        (words[start - strideWords] >>> 1) & 0x7F7F7F7F
      );
      words[start] = left;
      for (let index = start + 1; index < end; index++) {
        left = addBytes(
          words[index],
          averageBytes(left, words[index - strideWords])
        );
        words[index] = left;
      }
      break;
    }
  }
}

function addBytes(
  left: number,
  right: number
): number {
  return ((left & 0x7F7F7F7F) + (right & 0x7F7F7F7F)) ^
    ((left ^ right) & 0x80808080);
}

function averageBytes(
  left: number,
  right: number
): number {
  return (left & right) + (((left ^ right) >>> 1) & 0x7F7F7F7F);
}

function paeth(
  left: number,
  up: number,
  upLeft: number
): number {
  const towardUp = up - upLeft;
  const towardLeft = left - upLeft;
  const distanceLeft = abs(towardUp);
  const distanceUp = abs(towardLeft);
  const distanceUpLeft = abs(towardUp + towardLeft);
  const notLeft = (
    (distanceUp - distanceLeft) | (distanceUpLeft - distanceLeft)
  ) >> 31;
  const notUp = (distanceUpLeft - distanceUp) >> 31;
  const fallback = up ^ ((up ^ upLeft) & notUp);

  return left ^ ((left ^ fallback) & notLeft);
}

function magnitude(
  residual: number
): number {
  return abs((residual << 24) >> 24);
}

function abs(
  value: number
): number {
  const sign = value >> 31;

  return (value ^ sign) - sign;
}
