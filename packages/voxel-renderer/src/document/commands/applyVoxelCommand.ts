// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import { decodeBlocksetSlot } from "../blocks/BlockId.ts";
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
    return world.applyCommand(command, logger);
  }

  return blocksets.applyCommand(
    command,
    () => [
      ...world.countBlocks().keys(),
      ...world.templates.countBlocks().keys()
    ].map(decodeBlocksetSlot)
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
    return target.blocks.applyCommand(command, target.blocksets.defaultBlocksetId);
  }
  if (isVoxelMaterialGroupCommand(command)) {
    return target.materialGroups.applyCommand(command);
  }
  if (isVoxelBlendGroupCommand(command)) {
    return target.blendGroups.applyCommand(command);
  }

  return applyVoxelWorldCommand(target, command, logger);
}
