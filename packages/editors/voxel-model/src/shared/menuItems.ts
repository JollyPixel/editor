// Import Internal Dependencies
import type { MenuItem } from "./menuSession.ts";

export const RENAME_ITEM: MenuItem<"rename"> = {
  id: "rename",
  label: "Rename",
  icon: "action-rename"
};

export const DUPLICATE_ITEM: MenuItem<"duplicate"> = {
  id: "duplicate",
  label: "Duplicate",
  icon: "action-duplicate"
};

export const DELETE_ITEM: MenuItem<"delete"> = {
  id: "delete",
  label: "Delete",
  icon: "action-delete"
};
