/**
 * Returns the next enabled index or `-1` when none are enabled.
 */
export function nextEnabledIndex(
  enabled: readonly boolean[],
  from: number,
  step: number
): number {
  const count = enabled.length;
  if (count === 0 || step === 0) {
    return -1;
  }

  for (let offset = 1; offset <= count; offset++) {
    const index = wrap(
      from + (step * offset),
      count
    );
    if (enabled[index]) {
      return index;
    }
  }

  return -1;
}

function wrap(
  index: number,
  count: number
): number {
  return ((index % count) + count) % count;
}
