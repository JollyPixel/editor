// Import Internal Dependencies
import {
  captureVoxelLayer,
  captureVoxelTemplate,
  captureVoxelWorld
} from "./data/captureVoxelWorld.ts";
import {
  restoreVoxelTemplate,
  restoreVoxelWorld
} from "./data/restoreVoxelWorld.ts";
import {
  parseVoxelTemplate,
  parseVoxelWorld
} from "./json/parseVoxelWorld.ts";
import {
  readVoxelTemplate,
  readVoxelWorld
} from "./json/readVoxelWorld.ts";
import {
  writeVoxelLayer,
  writeVoxelTemplate,
  writeVoxelWorld
} from "./json/writeVoxelWorld.ts";
import type {
  VoxelLayerJSON,
  VoxelTemplateJSON,
  VoxelWorldJSON
} from "./types.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { VoxelTemplate } from "../world/templates/VoxelTemplate.ts";
import { DEFAULT_CHUNK_SIZE } from "../world/storage/VoxelChunk.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { TilesetDefinition } from "../tilesets/types.ts";
import type { TilesetList } from "../tilesets/TilesetList.ts";

export interface VoxelSerializeOptions {
  tilesets?: Iterable<TilesetDefinition>;
}

export interface VoxelDeserializeOptions {
  tilesets?: TilesetList;
}

export function serializeVoxelWorld(
  world: VoxelWorld,
  options: VoxelSerializeOptions = {}
): VoxelWorldJSON {
  return writeVoxelWorld(
    captureVoxelWorld(world, options.tilesets)
  );
}

export function serializeVoxelLayer(
  layer: VoxelLayer
): VoxelLayerJSON {
  return writeVoxelLayer(
    captureVoxelLayer(layer),
    layer.chunkSize
  );
}

export function serializeVoxelTemplate(
  template: VoxelTemplate,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): VoxelTemplateJSON {
  return writeVoxelTemplate(
    captureVoxelTemplate(template, chunkSize)
  );
}

export function deserializeVoxelTemplate(
  data: VoxelTemplateJSON
): VoxelTemplate {
  return restoreVoxelTemplate(
    readVoxelTemplate(parseVoxelTemplate(data))
  );
}

export function deserializeVoxelWorld(
  data: VoxelWorldJSON,
  world: VoxelWorld,
  options: VoxelDeserializeOptions = {}
): void {
  restoreVoxelWorld(
    readVoxelWorld(parseVoxelWorld(data)),
    world,
    options.tilesets
  );
}
