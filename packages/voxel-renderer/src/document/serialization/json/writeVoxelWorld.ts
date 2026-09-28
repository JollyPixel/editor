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
  type VoxelEntryJSON,
  type VoxelLayerJSON,
  type VoxelTemplateJSON,
  type VoxelWorldJSON
} from "../types.ts";
import type {
  VoxelChunkData,
  VoxelLayerData,
  VoxelTemplateData,
  VoxelWorldData
} from "../data/types.ts";

interface VoxelGridJSON {
  palette: VoxelEntryJSON[];
  chunks: VoxelChunkJSON[];
}

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
    objectLayers: data.objectLayers,
    templates: data.templates.map(writeVoxelTemplate)
  };
}

export function writeVoxelLayer(
  layer: VoxelLayerData,
  chunkSize: number
): VoxelLayerJSON {
  const { chunks, ...metadata } = layer;

  return {
    ...metadata,
    ...writeVoxelGrid(chunks, chunkSize)
  };
}

export function writeVoxelTemplate(
  template: VoxelTemplateData
): VoxelTemplateJSON {
  const { chunks, ...metadata } = template;

  return {
    ...metadata,
    ...writeVoxelGrid(chunks, template.chunkSize)
  };
}

function writeVoxelGrid(
  chunks: VoxelChunkData[],
  chunkSize: number
): VoxelGridJSON {
  const cellCount = chunkSize ** 3;
  const palette = buildPalette(chunks.map((chunk) => chunk.voxels));

  return {
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
