// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelView
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BrushFootprint } from "../model/BrushFootprint.ts";

export function pickBlockAt(
  view: VoxelView,
  footprint: BrushFootprint
): number | null {
  const shown = view.document.world.getLayers().filter(
    (layer) => view.layerVisibility.isVisible(layer)
  );

  for (const cell of centerFirstCells(footprint)) {
    for (const layer of shown) {
      const entry = layer.getVoxelAt(cell);
      if (entry !== undefined) {
        return entry.blockId;
      }
    }
  }

  return null;
}

function* centerFirstCells(
  footprint: BrushFootprint
): IterableIterator<VoxelCoord> {
  const center = footprint.position;
  yield center;

  if (footprint.size <= 1) {
    return;
  }

  for (const cell of footprint.cells()) {
    if (
      cell.x !== center.x ||
      cell.y !== center.y ||
      cell.z !== center.z
    ) {
      yield cell;
    }
  }
}
