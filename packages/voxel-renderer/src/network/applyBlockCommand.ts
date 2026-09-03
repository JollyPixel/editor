// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { VoxelBlockCommand } from "./types.ts";

export function applyBlockCommand(
  registry: BlockRegistry,
  command: VoxelBlockCommand
): boolean {
  const version = registry.version;

  if (command.action === "block-removed") {
    registry.unregister(command.blockId);
  }
  else {
    registry.register(command.block);
  }

  return registry.version !== version;
}
