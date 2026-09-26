// Import Internal Dependencies
import { applyBlockCommand } from "../blocks/applyBlockCommand.ts";
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import {
  applyMaterialGroupCommand
} from "../materials/applyMaterialGroupCommand.ts";
import type { MaterialGroupList } from "../materials/MaterialGroupList.ts";
import { applyTilesetCommand } from "../tileset/applyTilesetCommand.ts";
import type { TilesetList } from "../tileset/TilesetList.ts";
import {
  isVoxelBlockCommand,
  isVoxelLayerCommand,
  isVoxelMaterialGroupCommand,
  isVoxelTilesetCommand
} from "./categories.ts";
import type {
  VoxelCommand,
  VoxelWorldCommand
} from "./types.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { VoxelLogger } from "../utils/logger.ts";

export interface VoxelWorldCommandTarget {
  readonly world: VoxelWorld;
  readonly tilesets: TilesetList;
}

export interface VoxelCommandTarget extends VoxelWorldCommandTarget {
  readonly blocks: BlockRegistry;
  readonly materialGroups: MaterialGroupList;
}

/**
 * Applies a layer or tileset link command and returns it as applied,
 * normalized the way peers should replay it, or null when it changed
 * nothing.
 */
export function applyVoxelWorldCommand(
  target: VoxelWorldCommandTarget,
  command: VoxelWorldCommand,
  logger?: VoxelLogger
): VoxelWorldCommand | null {
  if (isVoxelLayerCommand(command)) {
    return target.world.apply(command, logger);
  }
  if (isVoxelTilesetCommand(command)) {
    return applyTilesetCommand(target, command);
  }

  const unhandled: never = command;
  throw new Error(
    `applyVoxelWorldCommand: unhandled action '${(unhandled as VoxelWorldCommand).action}'.`
  );
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

  return applyVoxelWorldCommand(target, command, logger);
}
