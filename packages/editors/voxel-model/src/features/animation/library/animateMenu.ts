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
  | "unlink";

export type OwnAction =
  | "new-clip"
  | "share";

export type SharedAction =
  | "new-set"
  | "link-set";

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

export const SHARED_MENU: readonly MenuEntry<SharedAction>[] = [
  {
    id: "new-set",
    label: "New set…",
    icon: "plus"
  },
  {
    id: "link-set",
    label: "Link set…"
  }
];
