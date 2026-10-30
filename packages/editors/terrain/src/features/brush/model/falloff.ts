// CONSTANTS
export const FALLOFF_CURVES = Object.freeze([
  "smooth",
  "linear",
  "sphere",
  "sharp",
  "constant"
] as const);

export type FalloffCurve = typeof FALLOFF_CURVES[number];

export function falloffWeight(
  curve: FalloffCurve,
  distance: number
): number {
  if (distance > 1) {
    return 0;
  }

  const t = Math.max(distance, 0);
  switch (curve) {
    case "smooth":
      return 1 - t * t * (3 - 2 * t);
    case "linear":
      return 1 - t;
    case "sphere":
      return Math.sqrt(1 - t * t);
    case "sharp":
      return (1 - t) * (1 - t);
    default:
      return 1;
  }
}

export function halfWeightDistance(
  curve: FalloffCurve
): number | null {
  if (curve === "constant") {
    return null;
  }

  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2;
    if (falloffWeight(curve, middle) > 0.5) {
      low = middle;
    }
    else {
      high = middle;
    }
  }

  return (low + high) / 2;
}
