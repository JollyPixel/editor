// Import Internal Dependencies
import { MaterialGroup } from "./MaterialGroup.ts";
import type { MaterialGroupList } from "./MaterialGroupList.ts";
import type { VoxelMaterialGroupCommand } from "../commands.ts";

/**
 * Applies the command and returns it as applied, or null when it changed
 * nothing.
 */
export function applyMaterialGroupCommand(
  groups: MaterialGroupList,
  command: VoxelMaterialGroupCommand
): VoxelMaterialGroupCommand | null {
  if (command.action === "material-group-removed") {
    return groups.remove(command.groupId) ? command : null;
  }

  const group = MaterialGroup.parse(command.group);
  if (group === null || !groups.define(group)) {
    return null;
  }

  return {
    action: command.action,
    group: group.toJSON()
  };
}
