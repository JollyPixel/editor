// Import Third-party Dependencies
import {
  applyVoxelCommand,
  BlockRegistry,
  deserializeVoxelWorld,
  parseVoxelDocument,
  serializeVoxelWorld,
  TilesetList,
  VoxelWorld,
  type TilesetAssetReference,
  type VoxelCommandTarget,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelNetworkCommand } from "../network/types.ts";

export class VoxelMapState implements VoxelCommandTarget {
  readonly world: VoxelWorld;
  readonly blocks = new BlockRegistry();
  readonly tilesets = new TilesetList();

  constructor(
    chunkSize: number
  ) {
    this.world = new VoxelWorld(chunkSize);
  }

  toJSON(): VoxelWorldJSON {
    return serializeVoxelWorld(this.world, {
      tilesets: this.tilesets,
      defaultTileSize: this.tilesets.defaultTileSize,
      blocks: this.blocks
    });
  }

  load(
    document: VoxelWorldJSON
  ): void {
    deserializeVoxelWorld(document, this.world, {
      blocks: this.blocks,
      tilesets: this.tilesets
    });
  }

  applyCommand(
    command: VoxelNetworkCommand
  ): void {
    switch (command.action) {
      case "world-replace":
        this.load(
          parseVoxelDocument(command.data)
        );
        break;
      default:
        applyVoxelCommand(this, command);
    }
  }

  dependencies(): TilesetAssetReference[] {
    return [...this.tilesets].flatMap(
      ({ asset }) => (asset === undefined ? [] : [{ ...asset }])
    );
  }

  clear(): void {
    this.world.clear();
    this.blocks.clear();
    this.tilesets.clear();
  }
}
