// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

export interface BrushCursor {
  position: VoxelCoord;
  size: number;
}

export function cellsOf(
  cursor: BrushCursor
): VoxelCoord[] {
  const { position, size } = cursor;
  const half = Math.floor(size / 2);
  const cells: VoxelCoord[] = [];

  for (let dx = 0; dx < size; dx++) {
    for (let dz = 0; dz < size; dz++) {
      cells.push({
        x: position.x - half + dx,
        y: position.y,
        z: position.z - half + dz
      });
    }
  }

  return cells;
}

export function read(
  value: unknown
): BrushCursor | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const position = Reflect.get(value, "position");
  const size = Reflect.get(value, "size");
  if (
    typeof size !== "number" ||
    !Number.isFinite(size) ||
    size < 1 ||
    !isVoxelCoord(position)
  ) {
    return null;
  }

  return {
    position,
    size: Math.floor(size)
  };
}

export function equals(
  a: BrushCursor | null,
  b: BrushCursor | null
): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return a.size === b.size &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.position.z === b.position.z;
}

function isVoxelCoord(
  value: unknown
): value is VoxelCoord {
  return typeof value === "object" && value !== null &&
    typeof Reflect.get(value, "x") === "number" &&
    typeof Reflect.get(value, "y") === "number" &&
    typeof Reflect.get(value, "z") === "number";
}
