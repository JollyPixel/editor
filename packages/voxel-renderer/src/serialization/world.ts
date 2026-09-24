// Import Internal Dependencies
import { parseVoxelDocument } from "./document.ts";
import { BlockTextures } from "../blocks/BlockTextures.ts";
import type { VoxelWorldJSON } from "./types.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { TilesetDefinition } from "../tileset/types.ts";
import {
  packVoxel,
  type PackedVoxel
} from "../world/packedVoxel.ts";
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { ResolvedBlockDefinition } from "../blocks/BlockDefinition.ts";
import type { TilesetList } from "../tileset/TilesetList.ts";

export interface VoxelSerializeOptions {
  tilesets?: Iterable<TilesetDefinition>;
  defaultTileSize?: number;
  blocks?: Iterable<ResolvedBlockDefinition>;
}

export interface VoxelDeserializeOptions {
  blocks?: BlockRegistry;
  tilesets?: TilesetList;
}

export function serializeVoxelWorld(
  world: VoxelWorld,
  options: VoxelSerializeOptions = {}
): VoxelWorldJSON {
  const document: VoxelWorldJSON = {
    version: 1,
    chunkSize: world.chunkSize,
    tilesets: [...options.tilesets ?? []],
    layers: world
      .getLayers()
      .map((layer) => layer.toJSON()),
    objectLayers: [
      ...world.getObjectLayers()
    ]
  };
  if (options.defaultTileSize !== undefined) {
    document.defaultTileSize = options.defaultTileSize;
  }
  if (options.blocks) {
    document.blocks = [...options.blocks];
  }

  return document;
}

export function deserializeVoxelWorld(
  data: VoxelWorldJSON,
  world: VoxelWorld,
  options: VoxelDeserializeOptions = {}
): void {
  const { blocks, tilesets } = options;

  const document = parseVoxelDocument(data);

  tilesets?.replace(document.tilesets, document.defaultTileSize);
  if (blocks && document.blocks) {
    blocks.clear();
    blocks.registerMany(document.blocks);
  }
  if (blocks && tilesets) {
    const fallback = tilesets.defaultTilesetId;
    blocks.registerMany(
      [...blocks].map(
        (block) => BlockTextures.of(block).withTileset(fallback).applyTo(block)
      )
    );
  }

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
    layer.order = layerJSON.order;
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
    const layer = world.addObjectLayer(layerJSON.name, {
      visible: layerJSON.visible,
      order: layerJSON.order
    });

    layer.id = layerJSON.id;
    layer.objects = [...layerJSON.objects];
  }
}
