// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

export type BrushAxis = "xz" | "xy" | "yz" | "xyz";
export type BrushPattern = "square" | "circle";
export type CoordAxis = "x" | "y" | "z";
export type BrushAnchor = "bottom" | "top" | "center";

export const BRUSH_AXES: readonly BrushAxis[] = Object.freeze([
  "xz",
  "xy",
  "yz",
  "xyz"
]);
export const BRUSH_PATTERNS: readonly BrushPattern[] = Object.freeze([
  "square",
  "circle"
]);

// CONSTANTS
const kCoordAxes: readonly CoordAxis[] = ["x", "y", "z"];

export interface BrushShape {
  size: number;
  axis: BrushAxis;
  pattern: BrushPattern;
}

export interface BrushFootprint extends BrushShape {
  position: VoxelCoord;
  anchor?: BrushAnchor;
}

export interface BrushBounds {
  min: VoxelCoord;
  span: VoxelCoord;
}

export interface BrushPlane {
  axis: CoordAxis;
  value: number;
}

export function isBrushAxis(
  value: unknown
): value is BrushAxis {
  return value === "xz" ||
    value === "xy" ||
    value === "yz" ||
    value === "xyz";
}

export function isBrushAnchor(
  value: unknown
): value is BrushAnchor {
  return value === "bottom" ||
    value === "top" ||
    value === "center";
}

export function isBrushPattern(
  value: unknown
): value is BrushPattern {
  return value === "square" || value === "circle";
}

export function spans(
  axis: BrushAxis,
  coord: CoordAxis
): boolean {
  return axis.includes(coord);
}

export function lockAxisOf(
  axis: BrushAxis
): CoordAxis {
  switch (axis) {
    case "xy":
      return "z";
    case "yz":
      return "x";
    default:
      return "y";
  }
}

export function planeThrough(
  axis: BrushAxis,
  cell: VoxelCoord
): BrushPlane {
  const lock = lockAxisOf(axis);

  return {
    axis: lock,
    value: cell[lock]
  };
}

export function boundsOf(
  footprint: BrushFootprint
): BrushBounds {
  const { position, size, axis, anchor = "bottom" } = footprint;
  const half = Math.floor(size / 2);
  const lift = {
    bottom: 0,
    top: size - 1,
    center: half
  }[anchor];
  const min = { ...position };
  const span = {
    x: 1,
    y: 1,
    z: 1
  };

  for (const coord of kCoordAxes) {
    if (!spans(axis, coord)) {
      continue;
    }

    span[coord] = size;
    min[coord] = position[coord] - (coord === "y" ? lift : half);
  }

  return {
    min,
    span
  };
}

export function cellsOf(
  footprint: BrushFootprint
): VoxelCoord[] {
  const { min, span } = boundsOf(footprint);
  const circle = footprint.pattern === "circle";
  const radius = footprint.size / 2;
  const cells: VoxelCoord[] = [];

  for (let dx = 0; dx < span.x; dx++) {
    for (let dy = 0; dy < span.y; dy++) {
      for (let dz = 0; dz < span.z; dz++) {
        const cell = {
          x: min.x + dx,
          y: min.y + dy,
          z: min.z + dz
        };
        if (circle && !withinRadius(footprint, min, cell, radius)) {
          continue;
        }

        cells.push(cell);
      }
    }
  }

  return cells;
}

export function overlaps(
  a: BrushFootprint | null,
  b: BrushFootprint | null
): boolean {
  if (a === null || b === null) {
    return false;
  }

  const left = boundsOf(a);
  const right = boundsOf(b);

  return kCoordAxes.every((coord) => {
    const leftEnd = left.min[coord] + left.span[coord];
    const rightEnd = right.min[coord] + right.span[coord];

    return left.min[coord] < rightEnd && right.min[coord] < leftEnd;
  });
}

function withinRadius(
  footprint: BrushFootprint,
  min: VoxelCoord,
  cell: VoxelCoord,
  radius: number
): boolean {
  let distance = 0;

  for (const coord of kCoordAxes) {
    if (!spans(footprint.axis, coord)) {
      continue;
    }

    const offset = cell[coord] + 0.5 - (min[coord] + radius);
    distance += offset * offset;
  }

  return distance <= radius * radius;
}
