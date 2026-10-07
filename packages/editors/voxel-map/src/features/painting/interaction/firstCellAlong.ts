// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { CellRay } from "./cellFaceStep.ts";

// CONSTANTS
const kAxes = ["x", "y", "z"] as const;
const kReachEpsilon = 1e-6;

type Axis = typeof kAxes[number];

export function firstCellAlong(
  ray: CellRay,
  distance: number,
  matches: (cell: VoxelCoord) => boolean
): VoxelCoord | null {
  const cell = {
    x: Math.floor(ray.origin.x),
    y: Math.floor(ray.origin.y),
    z: Math.floor(ray.origin.z)
  };
  const step = {
    x: 0,
    y: 0,
    z: 0
  };
  const next = {
    x: Infinity,
    y: Infinity,
    z: Infinity
  };
  const span = {
    x: Infinity,
    y: Infinity,
    z: Infinity
  };
  for (const axis of kAxes) {
    const direction = ray.direction[axis];
    if (direction > 0) {
      step[axis] = 1;
      next[axis] = (cell[axis] + 1 - ray.origin[axis]) / direction;
      span[axis] = 1 / direction;
    }
    else if (direction < 0) {
      step[axis] = -1;
      next[axis] = (cell[axis] - ray.origin[axis]) / direction;
      span[axis] = -1 / direction;
    }
  }

  let travelled = 0;
  while (travelled <= distance + kReachEpsilon) {
    if (matches(cell)) {
      return { ...cell };
    }

    const axis = nearestAxis(next);
    if (next[axis] === Infinity) {
      return null;
    }

    travelled = next[axis];
    cell[axis] += step[axis];
    next[axis] += span[axis];
  }

  return null;
}

function nearestAxis(
  next: VoxelCoord
): Axis {
  if (next.x <= next.y && next.x <= next.z) {
    return "x";
  }

  return next.y <= next.z ? "y" : "z";
}
