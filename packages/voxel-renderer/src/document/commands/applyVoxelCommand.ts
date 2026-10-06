// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import { blocksetSlotOf } from "../blocks/BlockId.ts";
import type { MaterialGroupList } from "../materials/MaterialGroupList.ts";
import type { BlendGroupList } from "../materials/BlendGroupList.ts";
import type { BlocksetList } from "../blocksets/BlocksetList.ts";
import {
  isVoxelBlendGroupCommand,
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
  readonly blocksets: BlocksetList;
}

export interface VoxelCommandTarget extends VoxelWorldCommandTarget {
  readonly blocks: BlockRegistry;
  readonly materialGroups: MaterialGroupList;
  readonly blendGroups: BlendGroupList;
}

/**
 * Applies a layer or blockset link command and returns it as applied,
 * normalized the way peers should replay it, or null when it changed
 * nothing.
 */
export function applyVoxelWorldCommand(
  target: VoxelWorldCommandTarget,
  command: VoxelWorldCommand,
  logger?: VoxelLogger
): VoxelWorldCommand | null {
  const { world, blocksets } = target;
  if (isVoxelLayerCommand(command) || isVoxelTemplateCommand(command)) {
    return world.apply(command, logger);
  }

  return blocksets.apply(
    command,
    () => [
      ...world.countBlocks().keys(),
      ...world.templates.countBlocks().keys()
    ].map(blocksetSlotOf)
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
    return target.blocks.apply(command, target.blocksets.defaultBlocksetId);
  }
  if (isVoxelMaterialGroupCommand(command)) {
    return target.materialGroups.apply(command);
  }
  if (isVoxelBlendGroupCommand(command)) {
    return target.blendGroups.apply(command);
  }

  return applyVoxelWorldCommand(target, command, logger);
}
