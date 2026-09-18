// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  boundsOf,
  type BrushFootprint,
  type CoordAxis
} from "./brushFootprint.ts";

// CONSTANTS
export const CELL_FACES: readonly CellFace[] = Object.freeze([
  "+x",
  "-x",
  "+y",
  "-y",
  "+z",
  "-z"
]);
const kFaceAxes: Record<CellFace, CoordAxis> = {
  "+x": "x",
  "-x": "x",
  "+y": "y",
  "-y": "y",
  "+z": "z",
  "-z": "z"
};
const kCrossAxes: Record<CoordAxis, readonly [CoordAxis, CoordAxis]> = {
  x: ["y", "z"],
  y: ["x", "z"],
  z: ["x", "y"]
};

export type CellFace = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export function isCellFace(
  value: unknown
): value is CellFace {
  return CELL_FACES.some((face) => face === value);
}

export function cellFaceOf(
  direction: VoxelCoord
): CellFace {
  const x = Math.abs(direction.x);
  const y = Math.abs(direction.y);
  const z = Math.abs(direction.z);

  if (y >= x && y >= z) {
    return direction.y < 0 ? "-y" : "+y";
  }
  if (x >= z) {
    return direction.x < 0 ? "-x" : "+x";
  }

  return direction.z < 0 ? "-z" : "+z";
}

export function faceCornersOf(
  footprint: BrushFootprint,
  face: CellFace,
  margin = 0
): VoxelCoord[] {
  const { min, span } = boundsOf(footprint);
  const axis = kFaceAxes[face];
  const [u, v] = kCrossAxes[axis];
  const plane = face[0] === "+" ?
    footprint.position[axis] + 1 + margin :
    footprint.position[axis] - margin;
  const lowU = min[u] - margin;
  const highU = min[u] + span[u] + margin;
  const lowV = min[v] - margin;
  const highV = min[v] + span[v] + margin;

  function corner(
    first: number,
    second: number
  ): VoxelCoord {
    const point = {
      x: 0,
      y: 0,
      z: 0
    };
    point[axis] = plane;
    point[u] = first;
    point[v] = second;

    return point;
  }

  return [
    corner(lowU, lowV),
    corner(highU, lowV),
    corner(highU, highV),
    corner(lowU, highV)
  ];
}
