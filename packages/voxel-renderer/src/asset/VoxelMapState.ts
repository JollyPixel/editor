// Import Internal Dependencies
import { VoxelWorld } from "../world/VoxelWorld.ts";
import {
  deserializeVoxelWorld,
  serializeVoxelWorld
} from "../serialization/world.ts";
import type { VoxelWorldJSON } from "../serialization/types.ts";
import type { TilesetDefinition } from "../tileset/types.ts";
import { BlockRegistry } from "../blocks/BlockRegistry.ts";

export class VoxelMapState {
  readonly world: VoxelWorld;
  readonly blocks = new BlockRegistry();
  tilesets: TilesetDefinition[] = [];

  constructor(
    chunkSize: number
  ) {
    this.world = new VoxelWorld(chunkSize);
  }

  toJSON(): VoxelWorldJSON {
    return serializeVoxelWorld(this.world, {
      tilesets: this.tilesets,
      blocks: this.blocks
    });
  }

  load(
    document: VoxelWorldJSON
  ): void {
    deserializeVoxelWorld(document, this.world, {
      blocks: this.blocks
    });
    this.tilesets = [...document.tilesets];
  }

  clear(): void {
    this.world.clear();
    this.blocks.clear();
    this.tilesets = [];
  }
}
