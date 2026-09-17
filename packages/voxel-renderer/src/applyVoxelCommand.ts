// Import Internal Dependencies
import { applyBlockCommand } from "./blocks/applyBlockCommand.ts";
import {
  applyTilesetCommand,
  type TilesetDocument
} from "./applyTilesetCommand.ts";
import {
  isVoxelBlockCommand,
  isVoxelLayerCommand,
  type VoxelCommand
} from "./commands.ts";
import type { VoxelWorld } from "./world/VoxelWorld.ts";
import type { VoxelLogger } from "./utils/logger.ts";

export interface VoxelCommandTarget extends TilesetDocument {
  readonly world: VoxelWorld;
}

export function applyVoxelCommand(
  target: VoxelCommandTarget,
  command: VoxelCommand,
  logger?: VoxelLogger
): boolean {
  if (isVoxelLayerCommand(command)) {
    target.world.apply(command, logger);

    return true;
  }
  if (isVoxelBlockCommand(command)) {
    return applyBlockCommand(target.blocks, command);
  }

  return applyTilesetCommand(target, command);
}
