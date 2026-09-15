// Import Third-party Dependencies
import {
  BlockRegistry,
  deserializeVoxelWorld,
  parseVoxelDocument,
  serializeVoxelWorld,
  type TilesetDefinition,
  VoxelWorld,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { applyBlockCommand } from "../network/applyBlockCommand.ts";
import { isVoxelBlockCommand } from "../network/VoxelCommandValidator.ts";
import type { VoxelNetworkCommand } from "../network/types.ts";

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

  applyCommand(
    command: VoxelNetworkCommand
  ): void {
    if (command.action === "world-replace") {
      this.load(parseVoxelDocument(command.data));
    }
    else if (isVoxelBlockCommand(command)) {
      applyBlockCommand(this.blocks, command);
    }
    else {
      this.world.applyRemoteCommand(command);
    }
  }

  clear(): void {
    this.world.clear();
    this.blocks.clear();
    this.tilesets = [];
  }
}
