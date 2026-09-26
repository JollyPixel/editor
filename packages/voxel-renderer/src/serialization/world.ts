// Import Internal Dependencies
import { parseVoxelDocument } from "./document.ts";
import {
  VOXEL_WORLD_VERSION,
  type VoxelWorldJSON
} from "./types.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { TilesetDefinition } from "../tileset/types.ts";
import {
  packVoxel,
  type PackedVoxel
} from "../world/packedVoxel.ts";
import type { TilesetList } from "../tileset/TilesetList.ts";

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
    layers: world
      .getLayers()
      .map((layer) => layer.toJSON()),
    objectLayers: world.objectLayers.toArray()
  };
}

export function deserializeVoxelWorld(
  data: VoxelWorldJSON,
  world: VoxelWorld,
  options: VoxelDeserializeOptions = {}
): void {
  const document = parseVoxelDocument(data);

  options.tilesets?.replace(document.tilesets);

  world.clear();

  const sortedLayers = [...document.layers]
    .sort((a, b) => a.order - b.order);

  for (const layerJSON of sortedLayers) {
    const layer = world.addLayer(layerJSON.name, {
      visible: layerJSON.visible,
      opacity: layerJSON.opacity,
      compositing: layerJSON.compositing,
      properties: layerJSON.properties
    });

    layer.id = layerJSON.id;
    if (layerJSON.position) {
      layer.position = { ...layerJSON.position };
    }

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

  for (const layerJSON of document.objectLayers ?? []) {
    const layer = world.objectLayers.add(layerJSON.name, {
      visible: layerJSON.visible,
      order: layerJSON.order
    });

    layer.id = layerJSON.id;
    layer.objects = [...layerJSON.objects];
  }
}
