// Import Internal Dependencies
import { applyBlockCommand } from "./blocks/applyBlockCommand.ts";
import {
  applyMaterialGroupCommand
} from "./materials/applyMaterialGroupCommand.ts";
import type { MaterialGroupList } from "./materials/MaterialGroupList.ts";
import {
  applyTilesetCommand,
  type TilesetDocument
} from "./applyTilesetCommand.ts";
import {
  isVoxelBlockCommand,
  isVoxelLayerCommand,
  isVoxelMaterialGroupCommand,
  type VoxelCommand
} from "./commands.ts";
import type { VoxelWorld } from "./world/VoxelWorld.ts";
import type { VoxelLogger } from "./utils/logger.ts";

export interface VoxelCommandTarget extends TilesetDocument {
  readonly world: VoxelWorld;
  readonly materialGroups: MaterialGroupList;
}

/**
 * Applies the command and returns it as applied, normalized the way peers
 * should replay it, or null when it changed nothing.
 */
export function applyVoxelCommand(
  target: VoxelCommandTarget,
  command: VoxelCommand,
  logger?: VoxelLogger
): VoxelCommand | null {
  if (isVoxelLayerCommand(command)) {
    target.world.apply(command, logger);

    return command;
  }
  if (isVoxelBlockCommand(command)) {
    return applyBlockCommand(
      target.blocks,
      command,
      target.tilesets.defaultTilesetId
    );
  }
  if (isVoxelMaterialGroupCommand(command)) {
    return applyMaterialGroupCommand(target.materialGroups, command);
  }

  return applyTilesetCommand(target, command);
}
