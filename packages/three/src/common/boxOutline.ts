// Import Third-party Dependencies
import type * as THREE from "three";

// CONSTANTS
export const BOX_EDGE_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
];

export function boxOutlinePositions(
  size: THREE.Vector3Like
): number[] {
  const { x, y, z } = size;
  const corners: readonly (readonly [number, number, number])[] = [
    [0, 0, 0], [x, 0, 0], [x, 0, z], [0, 0, z],
    [0, y, 0], [x, y, 0], [x, y, z], [0, y, z]
  ];

  return BOX_EDGE_PAIRS.flatMap(
    ([from, to]) => [
      ...corners[from],
      ...corners[to]
    ]
  );
}
