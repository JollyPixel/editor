// Import Third-party Dependencies
import {
  BlockRegistry,
  deserializeVoxelWorld,
  serializeVoxelWorld,
  type TilesetDefinition,
  VoxelWorld,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

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
