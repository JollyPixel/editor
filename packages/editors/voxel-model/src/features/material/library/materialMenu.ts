// Import Internal Dependencies
import type {
  MenuEntry,
  MenuItem
} from "../../../shared/menuSession.ts";
import {
  DELETE_ITEM,
  DUPLICATE_ITEM,
  RENAME_ITEM
} from "../../../shared/menuItems.ts";

// CONSTANTS
const kNewMaterial: MenuItem<"new-material"> = {
  id: "new-material",
  label: "New Material…",
  icon: "plus"
};
const kNewFolder: MenuItem<"new-folder"> = {
  id: "new-folder",
  label: "New Folder",
  icon: "folder-add"
};

export type MaterialAction =
  | "new-material"
  | "new-folder"
  | "paste"
  | "assign"
  | "rename"
  | "duplicate"
  | "copy"
  | "delete";

export type RootAction = Extract<MaterialAction, "new-material" | "new-folder" | "paste">;

export type FolderAction = Extract<MaterialAction, "new-material" | "new-folder" | "rename" | "delete">;

export type MaterialRowAction = Extract<
  MaterialAction,
  "assign" | "rename" | "duplicate" | "copy" | "delete"
>;

export const ROOT_MENU: readonly MenuEntry<RootAction>[] = [
  kNewMaterial,
  kNewFolder,
  "separator",
  {
    id: "paste",
    label: "Paste",
    icon: "material-paste"
  }
];

export const FOLDER_MENU: readonly MenuEntry<FolderAction>[] = [
  kNewMaterial,
  kNewFolder,
  RENAME_ITEM,
  "separator",
  DELETE_ITEM
];

export function materialMenu(
  assignTo: string | null
): MenuEntry<MaterialRowAction>[] {
  const assign: MenuEntry<MaterialRowAction>[] = assignTo === null ?
    [] :
    [
      {
        id: "assign",
        label: `Assign to ${assignTo}`,
        icon: "check"
      },
      "separator"
    ];

  return [
    ...assign,
    RENAME_ITEM,
    DUPLICATE_ITEM,
    {
      id: "copy",
      label: "Copy",
      icon: "material-copy"
    },
    "separator",
    DELETE_ITEM
  ];
}
