// Import Internal Dependencies
import type { MenuEntry } from "../../../shared/menu/MenuSession.ts";
import {
  DELETE_ITEM,
  DUPLICATE_ITEM,
  RENAME_ITEM
} from "../../../shared/menu/menuItems.ts";

export type MaterialAction =
  | "new-material"
  | "paste"
  | "rename"
  | "duplicate"
  | "copy"
  | "delete";

export type RootAction = Extract<MaterialAction, "new-material" | "paste">;

export type MaterialRowAction = Extract<
  MaterialAction,
  "rename" | "duplicate" | "copy" | "delete"
>;

export const ROOT_MENU: readonly MenuEntry<RootAction>[] = [
  {
    id: "new-material",
    label: "New Material…",
    icon: "plus"
  },
  "separator",
  {
    id: "paste",
    label: "Paste",
    icon: "material-paste"
  }
];

export const MATERIAL_MENU: readonly MenuEntry<MaterialRowAction>[] = [
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
