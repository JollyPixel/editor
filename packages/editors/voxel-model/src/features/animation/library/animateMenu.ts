// Import Third-party Dependencies
import type { MenuEntry, MenuItem } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  DELETE_ITEM,
  DUPLICATE_ITEM,
  RENAME_ITEM
} from "../../../shared/menu/menuItems.ts";

// CONSTANTS
const kNewClip: MenuItem<"new-clip"> = {
  id: "new-clip",
  label: "New Clip…",
  icon: "plus"
};

export type ClipAction =
  | "rename"
  | "duplicate"
  | "copy"
  | "delete";

export type SetAction =
  | "new-clip"
  | "rename"
  | "export"
  | "unlink";

export type OwnAction =
  | "new-clip"
  | "share";

export type SharedAction =
  | "new-set"
  | "link-set"
  | "import-set";

export function clipMenu(
  hasTargets: boolean
): readonly MenuEntry<ClipAction>[] {
  return [
    RENAME_ITEM,
    DUPLICATE_ITEM,
    "separator",
    {
      id: "copy",
      label: "Copy to…",
      disabled: !hasTargets
    },
    "separator",
    DELETE_ITEM
  ];
}

export const SET_MENU: readonly MenuEntry<SetAction>[] = [
  kNewClip,
  {
    ...RENAME_ITEM,
    label: "Rename…"
  },
  {
    id: "export",
    label: "Export…"
  },
  "separator",
  {
    id: "unlink",
    label: "Unlink from this model"
  }
];

export function ownMenu(
  canShare: boolean
): readonly MenuEntry<OwnAction>[] {
  return [
    kNewClip,
    {
      id: "share",
      label: "Share as set…",
      disabled: !canShare
    }
  ];
}

export function sharedMenu(
  canImport: boolean
): readonly MenuEntry<SharedAction>[] {
  return [
    {
      id: "new-set",
      label: "New set…",
      icon: "plus"
    },
    {
      id: "link-set",
      label: "Link set…"
    },
    {
      id: "import-set",
      label: "Import set…",
      disabled: !canImport
    }
  ];
}
