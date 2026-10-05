// Import Internal Dependencies
import { decodeChunk } from "../chunks/chunkEncoding.ts";
import { resolvePaletteValues } from "../chunks/palette.ts";
import { packVoxel } from "../../world/storage/packedVoxel.ts";
import type {
  VoxelChunkJSON,
  VoxelChunkPartnersJSON,
  VoxelEntryJSON,
  VoxelLayerJSON,
  VoxelTemplateJSON,
  VoxelWorldJSON
} from "../types.ts";
import type {
  VoxelCellData,
  VoxelChunkData,
  VoxelLayerData,
  VoxelTemplateData,
  VoxelWorldData
} from "../data/types.ts";

export function readVoxelWorld(
  document: VoxelWorldJSON
): VoxelWorldData {
  return {
    chunkSize: document.chunkSize,
    tilesets: document.tilesets,
    layers: document.layers.map(readVoxelLayer),
    objectLayers: document.objectLayers ?? [],
    templates: (document.templates ?? []).map(readVoxelTemplate)
  };
}

export function readVoxelTemplate(
  template: VoxelTemplateJSON
): VoxelTemplateData {
  return {
    id: template.id,
    name: template.name,
    pivot: template.pivot,
    properties: template.properties,
    chunkSize: template.chunkSize,
    chunks: readVoxelChunks(template.palette, template.chunks)
  };
}

function readVoxelLayer(
  layer: VoxelLayerJSON
): VoxelLayerData {
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    compositing: layer.compositing,
    rank: layer.rank,
    position: layer.position,
    properties: layer.properties,
    chunks: readVoxelChunks(layer.palette, layer.chunks)
  };
}

function readVoxelChunks(
  entries: VoxelEntryJSON[],
  chunks: VoxelChunkJSON[]
): VoxelChunkData[] {
  const palette = entries.map(
    ({ block, transform }) => packVoxel(block, transform)
  );

  return chunks.map((chunk) => readVoxelChunk(chunk, palette));
}

function readVoxelChunk(
  chunk: VoxelChunkJSON,
  palette: readonly number[]
): VoxelChunkData {
  const [cx, cy, cz] = chunk.at;
  const data: VoxelChunkData = {
    cx,
    cy,
    cz,
    ...readVoxelCells(chunk, palette)
  };
  if (chunk.partners !== undefined) {
    data.partners = readVoxelCells(chunk.partners, palette);
  }

  return data;
}

function readVoxelCells(
  encoded: VoxelChunkPartnersJSON,
  palette: readonly number[]
): VoxelCellData {
  const { cells, values } = decodeChunk({
    gaps: encoded.cells ?? null,
    runs: encoded.runs
  });

  return {
    cells,
    voxels: resolvePaletteValues(values, palette)
  };
}
