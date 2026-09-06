// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelEngine
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import * as cursor from "../model/brushCursor.ts";
import type { BrushStroke } from "../model/BrushStroke.ts";

/** Applies one group of stroke centers as a single world command. */
export function applyBrushStroke(
  engine: VoxelEngine,
  stroke: BrushStroke,
  centers: Iterable<VoxelCoord>,
  brushSize: number
): boolean {
  const cells: VoxelCoord[] = [];
  for (const position of centers) {
    cells.push(
      ...stroke.claim(cursor.cellsOf({
        position,
        size: brushSize
      }))
    );
  }
  if (cells.length === 0) {
    return false;
  }

  const { world } = engine;
  if (stroke.paint) {
    const {
      blockId,
      rotation,
      flipY
    } = stroke.paint;
    world.setVoxelBulk(
      stroke.layerName,
      cells.map((position) => {
        return {
          position,
          blockId,
          rotation,
          flipY
        };
      })
    );
  }
  else {
    const layer = world.getLayer(stroke.layerName);
    const entries = cells
      .filter((position) => layer?.getVoxelAt(position) !== undefined)
      .map((position) => {
        return { position };
      });
    if (entries.length === 0) {
      return false;
    }

    world.removeVoxelBulk(stroke.layerName, entries);
  }

  engine.flush();

  return true;
}
