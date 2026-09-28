// Import Internal Dependencies
import { parseVoxelWorld } from "./codec.ts";
import {
  VOXEL_WORLD_VERSION,
  type VoxelEntryJSON,
  type VoxelEntryKey,
  type VoxelLayerJSON,
  type VoxelWorldJSON
} from "./types.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { TilesetDefinition } from "../tilesets/types.ts";
import {
  packVoxel,
  voxelBlockId,
  voxelTransform,
  type PackedVoxel
} from "../world/storage/packedVoxel.ts";
import type { TilesetList } from "../tilesets/TilesetList.ts";

export interface VoxelSerializeOptions {
  tilesets?: Iterable<TilesetDefinition>;
}

export interface VoxelDeserializeOptions {
  tilesets?: TilesetList;
}

/**
 * The stored form of a tileset link. An asset tileset keeps only its id,
 * slot and reference, since the asset owns the tile size and grid.
 */
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

export function serializeVoxelWorld(
  world: VoxelWorld,
  options: VoxelSerializeOptions = {}
): VoxelWorldJSON {
  return {
    version: VOXEL_WORLD_VERSION,
    chunkSize: world.chunkSize,
    tilesets: Array.from(
      options.tilesets ?? [],
      serializeTilesetDefinition
    ),
    layers: world.getLayers().map(serializeVoxelLayer),
    objectLayers: world.objectLayers.toArray()
  };
}

export function serializeVoxelLayer(
  layer: VoxelLayer
): VoxelLayerJSON {
  const voxels: Record<VoxelEntryKey, VoxelEntryJSON> = {};
  for (const [x, y, z, packed] of layer.localVoxels()) {
    voxels[`${x},${y},${z}`] = {
      block: voxelBlockId(packed),
      transform: voxelTransform(packed)
    };
  }

  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    opacity: layer.opacity,
    compositing: layer.compositing,
    order: layer.order,
    position: { ...layer.position },
    properties: { ...layer.properties },
    voxels
  };
}

export function deserializeVoxelWorld(
  data: VoxelWorldJSON,
  world: VoxelWorld,
  options: VoxelDeserializeOptions = {}
): void {
  const document = parseVoxelWorld(data);

  options.tilesets?.replace(document.tilesets);

  world.clear();

  const sortedLayers = [...document.layers]
    .sort((a, b) => a.order - b.order);

  for (const layerJSON of sortedLayers) {
    const layer = world.restoreLayer({
      id: layerJSON.id,
      name: layerJSON.name,
      visible: layerJSON.visible,
      opacity: layerJSON.opacity,
      compositing: layerJSON.compositing,
      position: layerJSON.position,
      properties: layerJSON.properties
    });

    const entries = Object.entries(layerJSON.voxels);
    const positions = new Int32Array(entries.length * 3);
    const packed: PackedVoxel[] = [];
    for (const [key, entryJSON] of entries) {
      const parts = key.split(",");
      const x = parseInt(parts[0], 10);
      const y = parseInt(parts[1], 10);
      const z = parseInt(parts[2], 10);

      if (
        Number.isNaN(x) ||
        Number.isNaN(y) ||
        Number.isNaN(z)
      ) {
        continue;
      }

      const offset = packed.length * 3;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      packed.push(packVoxel(entryJSON.block, entryJSON.transform));
    }
    layer.loadPackedVoxels(positions, packed);
  }

  world.objectLayers.restore(document.objectLayers ?? []);
}
