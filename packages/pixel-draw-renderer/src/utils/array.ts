/**
 * Builds an array of `length` slots that all hold `value` (the same
 * reference for objects), without a per-element callback.
 */
export function filledArray<T>(
  length: number,
  value: T
): T[] {
  const array: T[] = [];
  array.length = length;

  return array.fill(value);
}
