// Import Internal Dependencies
import type {
  FolderCommand,
  FolderNodeJSON
} from "./types.ts";

export function applyFolderCommand(
  folders: Map<string, FolderNodeJSON>,
  placements: Map<string, string>,
  cmd: FolderCommand
): void {
  switch (cmd.action) {
    case "folder-added":
      folders.set(cmd.uuid, {
        uuid: cmd.uuid,
        name: cmd.name,
        parentId: cmd.parentId
      });
      break;

    case "folder-removed":
      folders.delete(cmd.uuid);
      break;

    case "folder-renamed": {
      const folder = folders.get(cmd.uuid);
      if (folder) {
        folders.set(cmd.uuid, { ...folder, name: cmd.name });
      }
      break;
    }

    case "folder-reparented": {
      const folder = folders.get(cmd.uuid);
      if (folder) {
        folders.set(cmd.uuid, { ...folder, parentId: cmd.parentId });
      }
      break;
    }

    case "block-placed":
      placements.set(cmd.blockUuid, cmd.folderId);
      break;

    case "block-unplaced":
      placements.delete(cmd.blockUuid);
      break;
  }
}
