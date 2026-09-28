// Import Internal Dependencies
import {
  captureVoxelLayer,
  captureVoxelWorld
} from "./data/captureVoxelWorld.ts";
import { restoreVoxelWorld } from "./data/restoreVoxelWorld.ts";
import { parseVoxelWorld } from "./json/parseVoxelWorld.ts";
import { readVoxelWorld } from "./json/readVoxelWorld.ts";
import {
  writeVoxelLayer,
  writeVoxelWorld
} from "./json/writeVoxelWorld.ts";
import type {
  VoxelLayerJSON,
  VoxelWorldJSON
} from "./types.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
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
