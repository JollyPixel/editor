// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelEngine
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import * as cursor from "../model/brushCursor.ts";

export function pickBlockAt(
  engine: VoxelEngine,
  center: VoxelCoord,
  brushSize: number
): number | null {
  const { world } = engine;

  for (const cell of footprintOf(center, brushSize)) {
    const entry = world.getVoxelAt(cell);
    if (entry !== undefined) {
      return entry.blockId;
    }
  }

  return null;
}

function* footprintOf(
  center: VoxelCoord,
  brushSize: number
): IterableIterator<VoxelCoord> {
  yield center;

  if (brushSize <= 1) {
    return;
  }

  for (const cell of cursor.cellsOf({
    position: center,
    size: brushSize
  })) {
    if (
      cell.x !== center.x ||
      cell.z !== center.z
    ) {
      yield cell;
    }
  }
}
