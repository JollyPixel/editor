// Import Internal Dependencies
import { decodeChunk } from "../chunks/chunkEncoding.ts";
import { resolvePaletteValues } from "../chunks/palette.ts";
import { packVoxel } from "../../world/storage/packedVoxel.ts";
import type {
  VoxelChunkJSON,
  VoxelLayerJSON,
  VoxelWorldJSON
} from "../types.ts";
import type {
  VoxelChunkData,
  VoxelLayerData,
  VoxelWorldData
} from "../data/types.ts";

export function readVoxelWorld(
  document: VoxelWorldJSON
): VoxelWorldData {
  return {
    chunkSize: document.chunkSize,
    tilesets: document.tilesets,
    layers: document.layers.map(readVoxelLayer),
    objectLayers: document.objectLayers ?? []
  };
}

function readVoxelLayer(
  layer: VoxelLayerJSON
): VoxelLayerData {
  const palette = layer.palette.map(
    ({ block, transform }) => packVoxel(block, transform)
  );

  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    opacity: layer.opacity,
    compositing: layer.compositing,
    order: layer.order,
    position: layer.position,
    properties: layer.properties,
    chunks: layer.chunks.map((chunk) => readVoxelChunk(chunk, palette))
  };
}

function readVoxelChunk(
  chunk: VoxelChunkJSON,
  palette: readonly number[]
): VoxelChunkData {
  const { cells, values } = decodeChunk({
    gaps: chunk.cells ?? null,
    runs: chunk.runs
  });
  const [cx, cy, cz] = chunk.at;

  return {
    cx,
    cy,
    cz,
    cells,
    voxels: resolvePaletteValues(values, palette)
  };
}
