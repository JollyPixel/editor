// Import Internal Dependencies
import type { VoxelLayer } from "../../world/VoxelLayer.ts";
import type { VoxelWorld } from "../../world/VoxelWorld.ts";
import type { VoxelChunk } from "../../world/storage/VoxelChunk.ts";
import type { TilesetDefinition } from "../../tilesets/types.ts";
import type {
  VoxelChunkData,
  VoxelLayerData,
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
    objectLayers: world.objectLayers.toArray()
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
    opacity: layer.opacity,
    compositing: layer.compositing,
    order: layer.order,
    position: { ...layer.position },
    properties: { ...layer.properties },
    chunks
  };
}

function captureVoxelChunk(
  chunk: VoxelChunk
): VoxelChunkData {
  const { store } = chunk;
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
    voxels[i] = store.get(cells[i]);
  }

  return {
    cx: chunk.cx,
    cy: chunk.cy,
    cz: chunk.cz,
    cells,
    voxels
  };
}
