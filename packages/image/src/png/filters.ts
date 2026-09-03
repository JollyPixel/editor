// CONSTANTS
const kFilterCount = 5;

export const FILTER_TYPES = [
  0,
  1,
  2,
  3,
  4
] as const;

export type FilterType = typeof FILTER_TYPES[number];

export type Samples = Uint8Array | Uint8ClampedArray;

export function applyFilter(
  filter: FilterType,
  row: Samples,
  above: Samples | null,
  bytesPerPixel: number,
  out: Uint8Array
): void {
  for (let index = 0; index < row.length; index++) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = above === null ? 0 : above[index];
    const upLeft = above === null || index < bytesPerPixel ?
      0 :
      above[index - bytesPerPixel];

    out[index] = filtered(
      filter,
      row[index],
      left,
      up,
      upLeft
    );
  }
}

export function chooseFilter(
  row: Samples,
  above: Samples | null,
  bytesPerPixel: number
): FilterType {
  let best: FilterType = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let filter = 0; filter < kFilterCount; filter++) {
    const score = scoreFilter(
      filter as FilterType,
      row,
      above,
      bytesPerPixel
    );
    if (score < bestScore) {
      bestScore = score;
      best = filter as FilterType;
    }
  }

  return best;
}

function scoreFilter(
  filter: FilterType,
  row: Samples,
  above: Samples | null,
  bytesPerPixel: number
): number {
  let sum = 0;

  for (let index = 0; index < row.length; index++) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = above === null ? 0 : above[index];
    const upLeft = above === null || index < bytesPerPixel ?
      0 :
      above[index - bytesPerPixel];

    const value = filtered(
      filter,
      row[index],
      left,
      up,
      upLeft
    );
    sum += value < 128 ? value : 256 - value;
  }

  return sum;
}

function filtered(
  filter: FilterType,
  value: number,
  left: number,
  up: number,
  upLeft: number
): number {
  switch (filter) {
    case 1:
      return (value - left) & 0xFF;
    case 2:
      return (value - up) & 0xFF;
    case 3:
      return (value - ((left + up) >> 1)) & 0xFF;
    case 4:
      return (value - paeth(left, up, upLeft)) & 0xFF;
    default:
      return value;
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
