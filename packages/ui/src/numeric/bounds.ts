// Import Third-party Dependencies
import { clamp } from "@jolly-pixel/utils";

export function unitRatio(
  value: number,
  min: number,
  max: number,
  degenerate = 0
): number {
  const span = max - min;
  if (span <= 0) {
    return degenerate;
  }

  return clamp((value - min) / span, 0, 1);
}
