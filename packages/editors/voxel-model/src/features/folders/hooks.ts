export type FolderHookEvent =
  | {
    action: "folder-added";
    uuid: string;
    name: string;
    parentId: string | null;
  }
  | {
    action: "folder-removed";
    uuid: string;
  }
  | {
    action: "folder-renamed";
    uuid: string;
    name: string;
  }
  | {
    action: "folder-reparented";
    uuid: string;
    parentId: string | null;
  }
  | {
    /** A root block (no physical parent) is organized under a folder. */
    action: "block-placed";
    blockUuid: string;
    folderId: string;
  }
  | {
    /** A block leaves every folder, back to the unorganized root. */
    action: "block-unplaced";
    blockUuid: string;
  };

export type FolderHookAction = FolderHookEvent["action"];

export const FOLDER_HOOK_ACTIONS: readonly FolderHookAction[] = [
  "folder-added",
  "folder-removed",
  "folder-renamed",
  "folder-reparented",
  "block-placed",
  "block-unplaced"
];

export type FolderHookListener = (
  event: FolderHookEvent
) => void;
