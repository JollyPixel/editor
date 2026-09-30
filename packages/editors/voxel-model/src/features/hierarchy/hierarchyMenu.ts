// Import Internal Dependencies
import type {
  MenuEntry,
  MenuItem
} from "../../shared/menuSession.ts";
import {
  DELETE_ITEM,
  DUPLICATE_ITEM,
  RENAME_ITEM
} from "../../shared/menuItems.ts";

// CONSTANTS
const kAddBlock: MenuItem<"add-block"> = {
  id: "add-block",
  label: "Add Block",
  icon: "plus"
};
const kAddFolder: MenuItem<"add-folder"> = {
  id: "add-folder",
  label: "Add Folder",
  icon: "folder-add"
};

export type HierarchyAction =
  | "rename"
  | "material"
  | "add-block"
  | "add-folder"
  | "duplicate"
  | "delete";

export type RootAction = Extract<HierarchyAction, "add-block" | "add-folder">;

export const ROOT_MENU: readonly MenuEntry<RootAction>[] = [
  kAddBlock,
  kAddFolder
];

export const BLOCK_MENU: readonly MenuEntry<HierarchyAction>[] = [
  {
    ...kAddBlock,
    label: "Add Child Block"
  },
  RENAME_ITEM,
  DUPLICATE_ITEM,
  "separator",
  {
    id: "material",
    label: "Material…",
    icon: "material"
  },
  "separator",
  DELETE_ITEM
];

export const FOLDER_MENU: readonly MenuEntry<HierarchyAction>[] = [
  kAddBlock,
  kAddFolder,
  RENAME_ITEM,
  DUPLICATE_ITEM,
  "separator",
  DELETE_ITEM
];
