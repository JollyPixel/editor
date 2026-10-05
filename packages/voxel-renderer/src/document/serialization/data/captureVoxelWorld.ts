// Import Internal Dependencies
import { VoxelLayer } from "../../world/VoxelLayer.ts";
import type { VoxelTemplate } from "../../world/templates/VoxelTemplate.ts";
import type { VoxelWorld } from "../../world/VoxelWorld.ts";
import type { VoxelChunk } from "../../world/storage/VoxelChunk.ts";
import type { VoxelStore } from "../../world/storage/VoxelStore.ts";
import { unmarkMerged } from "../../world/storage/mergedVoxel.ts";
import type { TilesetDefinition } from "../../tilesets/types.ts";
import type {
  VoxelCellData,
  VoxelChunkData,
  VoxelLayerData,
  VoxelTemplateData,
  VoxelWorldData
} from "./types.ts";

export function serializeTilesetDefinition(
  definition: TilesetDefinition
): TilesetDefinition {
  const {
    tileSize: _tileSize,
    cols: _cols,
    rows: _rows,
    ...link
  } = definition;
  if (definition.asset !== undefined) {
    return {
      ...link,
      asset: { ...definition.asset }
    };
  }

  return { ...definition };
}

export function captureVoxelWorld(
  world: VoxelWorld,
  tilesets: Iterable<TilesetDefinition> = []
): VoxelWorldData {
  return {
    chunkSize: world.chunkSize,
    tilesets: Array.from(tilesets, serializeTilesetDefinition),
    layers: world.getLayers().map(captureVoxelLayer),
    objectLayers: world.objectLayers.toArray(),
    templates: world.templates.toArray().map(
      (template) => captureVoxelTemplate(template, world.chunkSize)
    )
  };
}

export function captureVoxelTemplate(
  template: VoxelTemplate,
  chunkSize: number
): VoxelTemplateData {
  const positions = new Int32Array(template.voxelCount * 3);
  const voxels = new Uint32Array(template.voxelCount);
  const partners = new Int32Array(template.voxelCount);
  let index = 0;
  for (const [x, y, z, packed, partner] of template.localVoxels()) {
    positions.set([x, y, z], index * 3);
    partners[index] = partner;
    voxels[index++] = packed;
  }

  const layer = new VoxelLayer({
    id: template.id,
    name: template.name,
    order: 0,
    chunkSize
  });
  layer.loadPackedVoxels(positions, voxels, partners);

  return {
    id: template.id,
    name: template.name,
    pivot: { ...template.pivot },
    properties: structuredClone(template.properties),
    chunkSize,
    chunks: captureVoxelLayer(layer).chunks
  };
}

export function captureVoxelLayer(
  layer: VoxelLayer
): VoxelLayerData {
  const chunks: VoxelChunkData[] = [];
  for (const chunk of layer.getChunks()) {
    if (chunk.voxelCount > 0) {
      chunks.push(captureVoxelChunk(chunk));
    }
  }
  chunks.sort((a, b) => a.cz - b.cz || a.cy - b.cy || a.cx - b.cx);

  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    compositing: layer.compositing,
    rank: layer.rank,
    position: { ...layer.position },
    properties: { ...layer.properties },
    chunks
  };
}

function captureVoxelChunk(
  chunk: VoxelChunk
): VoxelChunkData {
  const data: VoxelChunkData = {
    cx: chunk.cx,
    cy: chunk.cy,
    cz: chunk.cz,
    ...captureCells(chunk.store)
  };
  if (chunk.partners !== null && chunk.partners.size > 0) {
    data.partners = captureCells(chunk.partners);
  }

  return data;
}

function captureCells(
  store: VoxelStore
): VoxelCellData {
  const { keys, capacity } = store;
  const cells = new Uint32Array(store.size);

  let count = 0;
  for (let slot = 0; slot < capacity; slot++) {
    if (keys[slot] >= 0) {
      cells[count++] = keys[slot];
    }
  }
  cells.sort();

  const voxels = new Uint32Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    voxels[i] = unmarkMerged(store.get(cells[i]));
  }

  return {
    cells,
    voxels
  };
}
