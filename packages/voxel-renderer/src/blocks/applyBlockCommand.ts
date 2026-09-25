// Import Internal Dependencies
import type { BlockRegistry } from "./BlockRegistry.ts";
import { BlockTextures } from "./BlockTextures.ts";
import {
  resolveBlockDefinition,
  type BlockDefinition
} from "./BlockDefinition.ts";
import type { VoxelBlockCommand } from "../commands/types.ts";

type BlockDefinedCommand = Extract<
  VoxelBlockCommand,
  { action: "block-defined"; }
>;

/**
 * Applies the command and returns it as applied, or null when it changed
 * nothing.
 */
export function applyBlockCommand(
  registry: BlockRegistry,
  command: VoxelBlockCommand,
  defaultTilesetId: string | null
): VoxelBlockCommand | null {
  switch (command.action) {
    case "block-defined":
      return defineBlock(registry, command.block, defaultTilesetId);
    case "block-removed":
      return registry.unregister(command.blockId) ? command : null;
    case "block-moved":
      if (!registry.moveTo(command.blockId, command.toIndex)) {
        return null;
      }

      return {
        ...command,
        toIndex: registry.indexOf(command.blockId)
      };
    default: {
      const unhandled: never = command;
      throw new Error(
        `applyBlockCommand: unhandled action '${(unhandled as VoxelBlockCommand).action}'.`
      );
    }
  }
}

/**
 * Registers the block with the default tileset filled into its texture
 * references that name none.
 */
function defineBlock(
  registry: BlockRegistry,
  definition: BlockDefinition,
  defaultTilesetId: string | null
): BlockDefinedCommand {
  const resolved = resolveBlockDefinition(definition);
  const block = BlockTextures.of(resolved)
    .withTileset(defaultTilesetId)
    .applyTo(resolved);
  registry.register(block);

  return {
    action: "block-defined",
    block
  };
}
