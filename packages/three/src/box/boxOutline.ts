// Import Third-party Dependencies
import type * as THREE from "three";

// CONSTANTS
export const BOX_EDGE_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
];
export const BOX_EDGE_POSITION_STRIDE = 6;

const kCornerUnits: readonly (readonly [number, number, number])[] = [
  [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1],
  [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]
];

export function writeBoxOutline(
  size: THREE.Vector3Like,
  target: Float32Array
): void {
  const { x, y, z } = size;

  let offset = 0;
  for (const pair of BOX_EDGE_PAIRS) {
    for (const corner of pair) {
      const [unitX, unitY, unitZ] = kCornerUnits[corner];
      target[offset++] = unitX * x;
      target[offset++] = unitY * y;
      target[offset++] = unitZ * z;
    }
  }
}
