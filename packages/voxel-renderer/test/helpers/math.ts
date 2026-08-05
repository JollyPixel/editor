// CONSTANTS
export const EPSILON = 1e-10;

/** Floating-point comparison for assertions on derived UV/geometry math. */
export function approxEqual(
  a: number,
  b: number
): boolean {
  return Math.abs(a - b) < EPSILON;
}
