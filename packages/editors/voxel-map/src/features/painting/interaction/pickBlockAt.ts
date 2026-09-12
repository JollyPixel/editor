// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelEngine
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  cellsOf,
  type BrushFootprint
} from "../model/brushFootprint.ts";

export function pickBlockAt(
  engine: VoxelEngine,
  footprint: BrushFootprint
): number | null {
  const { world } = engine;

  for (const cell of footprintOf(footprint)) {
    const entry = world.getVoxelAt(cell);
    if (entry !== undefined) {
      return entry.blockId;
    }
  }

  return null;
}

function* footprintOf(
  footprint: BrushFootprint
): IterableIterator<VoxelCoord> {
  const center = footprint.position;
  yield center;

  if (footprint.size <= 1) {
    return;
  }

  for (const cell of cellsOf(footprint)) {
    if (
      cell.x !== center.x ||
      cell.y !== center.y ||
      cell.z !== center.z
    ) {
      yield cell;
    }
  }
}
