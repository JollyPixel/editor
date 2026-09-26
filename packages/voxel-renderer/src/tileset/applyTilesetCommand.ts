// Import Internal Dependencies
import { tilesetSlotOf } from "../blocks/BlockId.ts";
import type { VoxelWorldCommandTarget } from "../commands/applyVoxelCommand.ts";
import type { VoxelTilesetCommand } from "../commands/types.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";

/**
 * Applies the command and returns it as applied, with the slot the tileset
 * received, or null when it changed nothing.
 */
export function applyTilesetCommand(
  target: VoxelWorldCommandTarget,
  command: VoxelTilesetCommand
): VoxelTilesetCommand | null {
  const { tilesets, world } = target;

  switch (command.action) {
    case "tileset-added": {
      const slot = command.tileset.slot ??
        tilesets.freeSlot(slotsInUse(world));
      if (slot === null || !tilesets.add({ ...command.tileset, slot })) {
        return null;
      }
      const tileset = tilesets.get(command.tileset.id);

      return tileset === undefined ? null : {
        action: "tileset-added",
        tileset
      };
    }
    case "tileset-removed":
      return tilesets.remove(command.tilesetId) ? command : null;
    default: {
      const unhandled: never = command;
      throw new Error(
        `applyTilesetCommand: unhandled action '${(unhandled as VoxelTilesetCommand).action}'.`
      );
    }
  }
}

function slotsInUse(
  world: VoxelWorld
): Iterable<number> {
  return Array.from(world.countBlocks().keys(), tilesetSlotOf);
}
