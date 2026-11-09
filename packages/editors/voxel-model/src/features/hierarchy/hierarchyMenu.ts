// Import Third-party Dependencies
import type {
  MenuBranch,
  MenuEntry,
  MenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  DELETE_ITEM,
  DUPLICATE_ITEM,
  RENAME_ITEM
} from "../../shared/menu/menuItems.ts";
import {
  BLOCK_SHAPES,
  type BlockShapeEntryId
} from "../../shared/blockShapes.ts";

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
const kShapeMenu: MenuBranch<BlockShapeEntryId> = {
  id: "shape",
  label: "Shape",
  icon: "block",
  items: BLOCK_SHAPES.map(({ id, label, icon }) => {
    return {
      id,
      label,
      icon
    };
  })
};

export type RowAction =
  | "rename"
  | "material"
  | "add-block"
  | "add-folder"
  | "duplicate"
  | "delete";

export type HierarchyAction = RowAction | BlockShapeEntryId;

export type RootAction = Extract<RowAction, "add-block" | "add-folder">;

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
  kShapeMenu,
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
