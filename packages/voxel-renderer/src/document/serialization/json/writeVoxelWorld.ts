// Import Internal Dependencies
import { encodeChunk } from "../chunks/chunkEncoding.ts";
import {
  buildPalette,
  toPaletteValues,
  type VoxelPalette
} from "../chunks/palette.ts";
import {
  voxelBlockId,
  voxelTransform
} from "../../world/storage/packedVoxel.ts";
import {
  VOXEL_WORLD_VERSION,
  type VoxelChunkJSON,
  type VoxelLayerJSON,
  type VoxelWorldJSON
} from "../types.ts";
import type {
  VoxelChunkData,
  VoxelLayerData,
  VoxelWorldData
} from "../data/types.ts";

export function writeVoxelWorld(
  data: VoxelWorldData
): VoxelWorldJSON {
  return {
    version: VOXEL_WORLD_VERSION,
    chunkSize: data.chunkSize,
    tilesets: data.tilesets,
    layers: data.layers.map(
      (layer) => writeVoxelLayer(layer, data.chunkSize)
    ),
    objectLayers: data.objectLayers
  };
}

export function writeVoxelLayer(
  layer: VoxelLayerData,
  chunkSize: number
): VoxelLayerJSON {
  const { chunks, ...metadata } = layer;
  const cellCount = chunkSize ** 3;
  const palette = buildPalette(chunks.map((chunk) => chunk.voxels));

  return {
    ...metadata,
    palette: palette.entries.map((packed) => {
      return {
        block: voxelBlockId(packed),
        transform: voxelTransform(packed)
      };
    }),
    chunks: chunks.map(
      (chunk) => writeVoxelChunk(chunk, palette, cellCount)
    )
  };
}

function writeVoxelChunk(
  chunk: VoxelChunkData,
  palette: VoxelPalette,
  cellCount: number
): VoxelChunkJSON {
  const at: [number, number, number] = [chunk.cx, chunk.cy, chunk.cz];
  const { gaps, runs } = encodeChunk(
    {
      cells: chunk.cells,
      values: toPaletteValues(chunk.voxels, palette)
    },
    cellCount
  );

  return gaps === null ?
    { at, runs } :
    { at, cells: gaps, runs };
}
