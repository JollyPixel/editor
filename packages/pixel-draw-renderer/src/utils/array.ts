export function filledArray<T>(
  length: number,
  value: T
): T[] {
  const array: T[] = [];
  array.length = length;

  return array.fill(value);
}
