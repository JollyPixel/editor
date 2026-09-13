export function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max);
}

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
