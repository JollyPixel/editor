// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  BrushAnchor,
  CoordAxis
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

export interface FaceAnchors {
  place: BrushAnchor;
  remove: BrushAnchor;
}

export function anchorsOf(
  face: CellFace | null
): FaceAnchors {
  switch (face) {
    case "+y":
      return {
        place: "bottom",
        remove: "top"
      };
    case "-y":
      return {
        place: "top",
        remove: "bottom"
      };
    default:
      return {
        place: "center",
        remove: "center"
      };
  }
}

export function faceCornersOf(
  cell: VoxelCoord,
  face: CellFace,
  margin = 0
): VoxelCoord[] {
  const axis = kFaceAxes[face];
  const [u, v] = kCrossAxes[axis];
  const plane = face[0] === "+" ?
    cell[axis] + 1 + margin :
    cell[axis] - margin;
  const lowU = cell[u] - margin;
  const highU = cell[u] + 1 + margin;
  const lowV = cell[v] - margin;
  const highV = cell[v] + 1 + margin;

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
