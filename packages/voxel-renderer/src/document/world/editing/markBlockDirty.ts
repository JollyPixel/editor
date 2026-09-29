// Import Internal Dependencies
import type { VoxelLayer } from "../VoxelLayer.ts";
import type { VoxelCoord } from "../types.ts";

interface VoxelBox {
  min: VoxelCoord;
  max: VoxelCoord;
}

export function markBlockDirty(
  layers: Iterable<VoxelLayer>,
  blockId: number,
  neighbours: boolean
): void {
  const margin = neighbours ? 1 : 0;
  const boxes: VoxelBox[] = [];
  for (const layer of layers) {
    const size = layer.chunkSize;
    const { x, y, z } = layer.position;
    for (const chunk of layer.getChunks()) {
      if (!chunk.countBlocks().has(blockId)) {
        continue;
      }

      const min = {
        x: x + (chunk.cx * size),
        y: y + (chunk.cy * size),
        z: z + (chunk.cz * size)
      };
      boxes.push({
        min: {
          x: min.x - margin,
          y: min.y - margin,
          z: min.z - margin
        },
        max: {
          x: min.x + size - 1 + margin,
          y: min.y + size - 1 + margin,
          z: min.z + size - 1 + margin
        }
      });
    }
  }

  for (const { min, max } of boxes) {
    for (const layer of layers) {
      layer.markBoxDirty(min, max);
    }
  }
}
