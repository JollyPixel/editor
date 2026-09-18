// Import Internal Dependencies
import type {
  VoxelBlockCommand,
  VoxelLayerCommand
} from "../../src/commands.ts";
import { resolveBlockDefinition } from "../../src/blocks/index.ts";
import { makeBlockDef } from "./blocks.ts";

type AddedCommand = Extract<VoxelLayerCommand, { action: "added"; }>;

export function makeAddedCommand(
  layerName: string
): AddedCommand {
  return {
    action: "added",
    layerName,
    metadata: { options: {} }
  };
}

export function blockDefinedCmd(
  options: { id?: number; } = {}
): Extract<VoxelBlockCommand, { action: "block-defined"; }> {
  return {
    action: "block-defined",
    block: resolveBlockDefinition(makeBlockDef(options.id ?? 1, "cube"))
  };
}

export function blockMovedCmd(
  options: { blockId?: number; toIndex?: number; } = {}
): Extract<VoxelBlockCommand, { action: "block-moved"; }> {
  return {
    action: "block-moved",
    blockId: options.blockId ?? 1,
    toIndex: options.toIndex ?? 0
  };
}
