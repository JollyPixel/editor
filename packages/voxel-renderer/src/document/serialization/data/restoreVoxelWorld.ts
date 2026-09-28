// Import Internal Dependencies
import type { VoxelLayer } from "../../world/VoxelLayer.ts";
import type { VoxelWorld } from "../../world/VoxelWorld.ts";
import { inChunkRange } from "../../world/storage/chunkKey.ts";
import type { TilesetList } from "../../tilesets/TilesetList.ts";
import { InvalidVoxelWorldError } from "../errors/InvalidVoxelWorldError.ts";
import type {
  VoxelChunkData,
  VoxelLayerData,
  VoxelWorldData
} from "./types.ts";

export function restoreVoxelWorld(
  data: VoxelWorldData,
  world: VoxelWorld,
  tilesets?: TilesetList
): void {
  assertChunksFit(data, world.chunkSize);

  tilesets?.replace(data.tilesets);
  world.clear();

  const sortedLayers = [...data.layers]
    .sort((a, b) => a.order - b.order);
  for (const layerData of sortedLayers) {
    const layer = world.restoreLayer({
      id: layerData.id,
      name: layerData.name,
      visible: layerData.visible,
      opacity: layerData.opacity,
      compositing: layerData.compositing,
      position: layerData.position,
      properties: layerData.properties
    });

    if (data.chunkSize === world.chunkSize) {
      for (const { cx, cy, cz, cells, voxels } of layerData.chunks) {
        layer.loadPackedChunk(cx, cy, cz, cells, voxels);
      }
    }
    else {
      loadRepartitioned(layer, layerData, data.chunkSize);
    }
  }

  world.objectLayers.restore(data.objectLayers);
}

function loadRepartitioned(
  layer: VoxelLayer,
  layerData: VoxelLayerData,
  chunkSize: number
): void {
  const shift = Math.log2(chunkSize);
  const mask = chunkSize - 1;

  let total = 0;
  for (const chunk of layerData.chunks) {
    total += chunk.cells.length;
  }

  const positions = new Int32Array(total * 3);
  const voxels = new Uint32Array(total);
  let offset = 0;
  for (const { cx, cy, cz, cells, voxels: packed } of layerData.chunks) {
    const originX = cx * chunkSize;
    const originY = cy * chunkSize;
    const originZ = cz * chunkSize;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      positions[offset * 3] = originX + (cell & mask);
      positions[(offset * 3) + 1] = originY + ((cell >> shift) & mask);
      positions[(offset * 3) + 2] = originZ + (cell >> (shift * 2));
      voxels[offset] = packed[i];
      offset++;
    }
  }

  layer.loadPackedVoxels(positions, voxels);
}

function assertChunksFit(
  data: VoxelWorldData,
  targetChunkSize: number
): void {
  const shift = Math.log2(targetChunkSize);
  const size = data.chunkSize;

  for (const layer of data.layers) {
    for (const chunk of layer.chunks) {
      if (
        !fits(chunk, size, shift, 0) ||
        !fits(chunk, size, shift, size - 1)
      ) {
        throw new InvalidVoxelWorldError(
          `layer "${layer.id}", chunk [${chunk.cx},${chunk.cy},${chunk.cz}] ` +
          `does not fit a world with chunkSize ${targetChunkSize}`
        );
      }
    }
  }
}

function fits(
  chunk: VoxelChunkData,
  size: number,
  shift: number,
  corner: number
): boolean {
  return inChunkRange(
    ((chunk.cx * size) + corner) >> shift,
    ((chunk.cy * size) + corner) >> shift,
    ((chunk.cz * size) + corner) >> shift
  );
}
