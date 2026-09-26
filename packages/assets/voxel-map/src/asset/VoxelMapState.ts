// Import Third-party Dependencies
import {
  applyVoxelWorldCommand,
  deserializeVoxelWorld,
  parseVoxelDocument,
  serializeVoxelWorld,
  TilesetList,
  VoxelWorld,
  type TilesetAssetReference,
  type VoxelWorldCommandTarget,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelNetworkCommand } from "../network/types.ts";

/**
 * The server's headless world: its layers and its tileset links.
 */
export class VoxelMapState implements VoxelWorldCommandTarget {
  readonly world: VoxelWorld;
  readonly tilesets = new TilesetList();

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
    deserializeVoxelWorld(document, this.world, {
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
        applyVoxelWorldCommand(this, command);
    }
  }

  dependencies(): TilesetAssetReference[] {
    return [...this.tilesets].flatMap(
      ({ asset }) => (asset === undefined ? [] : [{ ...asset }])
    );
  }

  clear(): void {
    this.world.clear();
    this.tilesets.clear();
  }
}
