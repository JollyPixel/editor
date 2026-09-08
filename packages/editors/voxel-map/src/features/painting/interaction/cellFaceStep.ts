// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kAxes = ["x", "y", "z"] as const;
const kParallelEpsilon = 1e-8;

type Axis = typeof kAxes[number];

export interface CellRay {
  origin: VoxelCoord;
  direction: VoxelCoord;
}

export function cellFaceStep(
  ray: CellRay,
  cell: VoxelCoord
): VoxelCoord | null {
  let entry = Number.NEGATIVE_INFINITY;
  let exit = Number.POSITIVE_INFINITY;
  let axis: Axis | null = null;

  for (const name of kAxes) {
    const direction = ray.direction[name];
    const min = cell[name] - ray.origin[name];
    const max = min + 1;

    if (Math.abs(direction) < kParallelEpsilon) {
      if (min > 0 || max < 0) {
        return null;
      }

      continue;
    }

    const first = min / direction;
    const second = max / direction;
    const near = Math.min(first, second);
    const far = Math.max(first, second);

    if (near > entry) {
      entry = near;
      axis = name;
    }
    exit = Math.min(exit, far);
  }

  if (
    axis === null ||
    entry > exit ||
    entry <= 0
  ) {
    return null;
  }

  return {
    x: 0,
    y: 0,
    z: 0,
    [axis]: ray.direction[axis] > 0 ? -1 : 1
  };
}
