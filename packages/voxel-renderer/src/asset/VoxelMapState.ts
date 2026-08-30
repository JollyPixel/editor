// Import Internal Dependencies
import { VoxelWorld } from "../world/VoxelWorld.ts";
import {
  deserializeVoxelWorld,
  serializeVoxelWorld
} from "../serialization/world.ts";
import type { VoxelWorldJSON } from "../serialization/types.ts";
import type { TilesetDefinition } from "../tileset/types.ts";

/**
 * A voxel world plus the tileset list a document carries but a world does not.
 */
export class VoxelMapState {
  readonly world: VoxelWorld;
  tilesets: TilesetDefinition[] = [];

  constructor(
    chunkSize: number
  ) {
    this.world = new VoxelWorld(chunkSize);
  }

  toJSON(): VoxelWorldJSON {
    return serializeVoxelWorld(this.world, {
      tilesets: this.tilesets
    });
  }

  load(
    document: VoxelWorldJSON
  ): void {
    deserializeVoxelWorld(document, this.world);
    this.tilesets = [...document.tilesets];
  }

  clear(): void {
    this.world.clear();
    this.tilesets = [];
  }
}
