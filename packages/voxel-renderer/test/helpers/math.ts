// CONSTANTS
const kEpsilon = 1e-10;

export function approxEqual(
  a: number,
  b: number
): boolean {
  return Math.abs(a - b) < kEpsilon;
}
