export interface NormalizedProgress {
  readonly max: number;
  readonly value: number | null;
  readonly ratio: number | null;
}

/**
 * Normalizes progress for rendering without changing the caller's raw values.
 * A missing value is indeterminate. Invalid numeric values render from zero.
 */
export function normalizeProgress(
  value: number | null,
  max: number
): NormalizedProgress {
  const normalizedMax = Number.isFinite(max) && max > 0
    ? max
    : 1;
  if (value === null) {
    return {
      max: normalizedMax,
      value: null,
      ratio: null
    };
  }

  const finiteValue = Number.isFinite(value) ? value : 0;
  const normalizedValue = Math.min(
    normalizedMax,
    Math.max(0, finiteValue)
  );

  return {
    max: normalizedMax,
    value: normalizedValue,
    ratio: normalizedValue / normalizedMax
  };
}
