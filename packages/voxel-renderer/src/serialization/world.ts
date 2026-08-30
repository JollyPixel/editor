// Import Internal Dependencies
import { parseVoxelDocument } from "./document.ts";
import {
  InvalidVoxelDocumentError
} from "./errors/InvalidVoxelDocumentError.ts";
import type { VoxelWorldJSON } from "./types.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { TilesetDefinition } from "../tileset/types.ts";
import type { VoxelEntry } from "../world/types.ts";
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { ResolvedBlockDefinition } from "../blocks/BlockDefinition.ts";

export interface VoxelSerializeOptions {
  tilesets?: Iterable<TilesetDefinition>;
  blocks?: Iterable<ResolvedBlockDefinition>;
}

export interface VoxelDeserializeOptions {
  blocks?: BlockRegistry;
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
  const document = parseVoxelDocument(data);
  if (document.chunkSize !== world.chunkSize) {
    throw new InvalidVoxelDocumentError(
      `chunkSize ${document.chunkSize} does not match the world's ${world.chunkSize}`
    );
  }

  options.blocks?.registerMany(
    document.blocks ?? [],
    { skipExisting: true }
  );

  world.clear();

  // Re-create layers in order (sorted ascending so order numbers are stable).
  const sortedLayers = [...document.layers]
    .sort((a, b) => a.order - b.order);

  for (const layerJSON of sortedLayers) {
    const layer = world.addLayer(layerJSON.name, {
      visible: layerJSON.visible,
      opacity: layerJSON.opacity,
      properties: layerJSON.properties
    });

    // Override the auto-assigned id/order with the serialised values.
    layer.id = layerJSON.id;
    layer.order = layerJSON.order;
    if (layerJSON.offset) {
      layer.offset = { ...layerJSON.offset };
    }

    for (const [key, entryJSON] of Object.entries(layerJSON.voxels)) {
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

      const entry: VoxelEntry = {
        blockId: entryJSON.block,
        transform: entryJSON.transform
      };
      layer.setVoxelAt({ x, y, z }, entry);
    }
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
