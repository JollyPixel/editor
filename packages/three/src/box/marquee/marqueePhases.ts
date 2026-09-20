// Import Third-party Dependencies
import type * as THREE from "three";

// CONSTANTS
const kRingCount = 2;
const kVerticalCount = 4;

export function marqueePhases(
  size: THREE.Vector3Like,
  dashLength: number
): number[] {
  const { x, y, z } = size;
  const ringLengths = [x, z, x, z];
  const perimeter = (x + z) * 2;
  const ringPeriods = wholePeriods(perimeter, dashLength);
  const verticalPeriods = wholePeriods(y, dashLength);

  const phases: number[] = [];
  for (let ring = 0; ring < kRingCount; ring++) {
    let travelled = 0;
    for (const length of ringLengths) {
      phases.push((travelled / perimeter) * ringPeriods);
      travelled += length;
      phases.push((travelled / perimeter) * ringPeriods);
    }
  }
  for (let vertical = 0; vertical < kVerticalCount; vertical++) {
    phases.push(0, verticalPeriods);
  }

  return phases;
}

function wholePeriods(
  length: number,
  dashLength: number
): number {
  return Math.max(
    Math.round(length / dashLength),
    1
  );
}
