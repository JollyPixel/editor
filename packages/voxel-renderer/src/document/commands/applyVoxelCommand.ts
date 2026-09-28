// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import { tilesetSlotOf } from "../blocks/BlockId.ts";
import type { MaterialGroupList } from "../materials/MaterialGroupList.ts";
import type { TilesetList } from "../tilesets/TilesetList.ts";
import {
  isVoxelBlockCommand,
  isVoxelLayerCommand,
  isVoxelMaterialGroupCommand,
  isVoxelTemplateCommand
} from "./categories.ts";
import type {
  VoxelCommand,
  VoxelWorldCommand
} from "./types.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { VoxelLogger } from "../../VoxelLogger.ts";

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
  const { world, tilesets } = target;
  if (isVoxelLayerCommand(command) || isVoxelTemplateCommand(command)) {
    return world.apply(command, logger);
  }

  return tilesets.apply(
    command,
    () => [
      ...world.countBlocks().keys(),
      ...world.templates.countBlocks().keys()
    ].map(tilesetSlotOf)
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
    return target.blocks.apply(command, target.tilesets.defaultTilesetId);
  }
  if (isVoxelMaterialGroupCommand(command)) {
    return target.materialGroups.apply(command);
  }

  return applyVoxelWorldCommand(target, command, logger);
}
