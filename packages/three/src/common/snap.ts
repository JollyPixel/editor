// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { Axis } from "./axes.ts";

export type SnapStep = number | THREE.Vector3Like | null;

export function snapStepFor(
  snap: SnapStep,
  axis: Axis
): number {
  if (snap === null) {
    return 0;
  }

  return typeof snap === "number" ? snap : snap[axis];
}

/**
 * Snaps to `step`; invalid or non-positive steps return `value`.
 */
export function snapValue(
  value: number,
  step: number
): number {
  if (!Number.isFinite(step) || step <= 0) {
    return value;
  }

  const snapped = Math.round(value / step) * step;

  return snapped === 0 ? 0 : snapped;
}
