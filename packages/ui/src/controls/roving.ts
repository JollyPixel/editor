// Import Third-party Dependencies
import { wrap } from "@jolly-pixel/utils";

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
