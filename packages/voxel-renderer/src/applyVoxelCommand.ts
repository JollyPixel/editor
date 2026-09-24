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
  if (isVoxelMaterialGroupCommand(command)) {
    return applyMaterialGroupCommand(target.materialGroups, command);
  }

  return applyTilesetCommand(target, command);
}
