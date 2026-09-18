// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord,
  type VoxelEngine,
  type VoxelEntry
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { cellsOf } from "../model/brushFootprint.ts";
import type {
  BrushStroke,
  VoxelPaint
} from "../model/BrushStroke.ts";

export function applyBrushStroke(
  engine: VoxelEngine,
  stroke: BrushStroke,
  centers: Iterable<VoxelCoord>,
  brushSize: number
): boolean {
  const cells: VoxelCoord[] = [];
  for (const position of centers) {
    cells.push(
      ...stroke.claim(cellsOf({
        position,
        size: brushSize,
        axis: stroke.axis,
        pattern: stroke.pattern,
        anchor: stroke.anchor
      }))
    );
  }
  if (cells.length === 0) {
    return false;
  }

  const { world } = engine;
  const layer = world.getLayer(stroke.layerName);
  if (stroke.paint) {
    const paint = stroke.paint;
    const transform = new VoxelTransform(paint).packed;
    const entries = cells
      .filter((position) => {
        const entry = layer?.getVoxelAt(position);

        return stroke.mode === "replace" ?
          entry !== undefined && !paints(entry, paint, transform) :
          entry === undefined;
      })
      .map((position) => {
        return {
          position,
          blockId: paint.blockId,
          rotation: paint.rotation,
          flipY: paint.flipY
        };
      });
    if (entries.length === 0) {
      return false;
    }

    world.setVoxelBulk(stroke.layerName, entries);
  }
  else {
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

function paints(
  entry: VoxelEntry,
  paint: VoxelPaint,
  transform: number
): boolean {
  return entry.blockId === paint.blockId &&
    entry.transform === transform;
}
