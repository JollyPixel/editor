// Import Internal Dependencies
import type { VoxelWorld } from "../../world/VoxelWorld.ts";
import { VoxelTemplate } from "../../world/templates/VoxelTemplate.ts";
import { inChunkRange } from "../../world/storage/chunkKey.ts";
import type { TilesetList } from "../../tilesets/TilesetList.ts";
import { InvalidVoxelWorldError } from "../errors/InvalidVoxelWorldError.ts";
import type {
  VoxelChunkData,
  VoxelTemplateData,
  VoxelWorldData
} from "./types.ts";

interface FlatVoxels {
  positions: Int32Array;
  voxels: Uint32Array;
}

export function restoreVoxelWorld(
  data: VoxelWorldData,
  world: VoxelWorld,
  tilesets?: TilesetList
): void {
  assertChunksFit(data, world.chunkSize);

  tilesets?.replace(data.tilesets);
  world.clear();

  for (const layerData of data.layers) {
    const layer = world.restoreLayer({
      id: layerData.id,
      name: layerData.name,
      rank: layerData.rank,
      visible: layerData.visible,
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
      const { positions, voxels } = flattenChunks(
        layerData.chunks,
        data.chunkSize
      );
      layer.loadPackedVoxels(positions, voxels);
    }
  }

  world.objectLayers.restore(data.objectLayers);
  world.templates.restore(data.templates.map(restoreVoxelTemplate));
}

export function restoreVoxelTemplate(
  data: VoxelTemplateData
): VoxelTemplate {
  const { positions, voxels } = flattenChunks(data.chunks, data.chunkSize);

  return new VoxelTemplate({
    id: data.id,
    name: data.name,
    pivot: data.pivot,
    properties: data.properties,
    positions,
    voxels
  });
}

function flattenChunks(
  chunks: VoxelChunkData[],
  chunkSize: number
): FlatVoxels {
  const shift = Math.log2(chunkSize);
  const mask = chunkSize - 1;

  let total = 0;
  for (const chunk of chunks) {
    total += chunk.cells.length;
  }

  const positions = new Int32Array(total * 3);
  const voxels = new Uint32Array(total);
  let offset = 0;
  for (const { cx, cy, cz, cells, voxels: packed } of chunks) {
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

  return { positions, voxels };
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
