// Import Internal Dependencies
import { applyBlockCommand } from "../blocks/applyBlockCommand.ts";
import {
  applyMaterialGroupCommand
} from "../materials/applyMaterialGroupCommand.ts";
import type { MaterialGroupList } from "../materials/MaterialGroupList.ts";
import {
  applyTilesetCommand,
  type TilesetDocument
} from "../tileset/applyTilesetCommand.ts";
import {
  isVoxelBlockCommand,
  isVoxelLayerCommand,
  isVoxelMaterialGroupCommand,
  isVoxelTilesetCommand
} from "./categories.ts";
import type { VoxelCommand } from "./types.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { VoxelLogger } from "../utils/logger.ts";

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
    return target.world.apply(command, logger);
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
  if (isVoxelTilesetCommand(command)) {
    return applyTilesetCommand(target, command);
  }

  const unhandled: never = command;
  throw new Error(
    `applyVoxelCommand: unhandled action '${(unhandled as VoxelCommand).action}'.`
  );
}
