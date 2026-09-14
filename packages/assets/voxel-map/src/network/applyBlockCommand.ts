// Import Third-party Dependencies
import type { BlockRegistry } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { VoxelBlockCommand } from "./types.ts";

export function applyBlockCommand(
  registry: BlockRegistry,
  command: VoxelBlockCommand
): boolean {
  const version = registry.version;

  switch (command.action) {
    case "block-removed":
      registry.unregister(command.blockId);
      break;
    case "block-moved":
      registry.moveTo(
        command.blockId,
        command.toIndex
      );
      break;
    default:
      registry.register(command.block);
      break;
  }

  return registry.version !== version;
}
