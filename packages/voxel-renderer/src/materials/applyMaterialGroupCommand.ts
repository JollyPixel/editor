// Import Internal Dependencies
import type { MaterialGroupList } from "./MaterialGroupList.ts";
import type { VoxelMaterialGroupCommand } from "../commands.ts";

export function applyMaterialGroupCommand(
  groups: MaterialGroupList,
  command: VoxelMaterialGroupCommand
): boolean {
  if (command.action === "material-group-removed") {
    return groups.remove(command.groupId);
  }

  return groups.define(command.group);
}
