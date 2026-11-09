// Import Third-party Dependencies
import type { MenuItem } from "@jolly-pixel/ui";

export const RENAME_ITEM: MenuItem<"rename"> = {
  id: "rename",
  label: "Rename",
  icon: "pencil"
};

export const DUPLICATE_ITEM: MenuItem<"duplicate"> = {
  id: "duplicate",
  label: "Duplicate",
  icon: "action-duplicate"
};

export const DELETE_ITEM: MenuItem<"delete"> = {
  id: "delete",
  label: "Delete",
  icon: "trash"
};
