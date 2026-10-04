// Import Third-party Dependencies
import type {
  ContextMenuEntry,
  ContextMenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import {
  newAssetAction,
  type AssetAction,
  type AssetSelection
} from "../../catalog/AssetSelection.ts";

// CONSTANTS
const kItems = {
  open: {
    id: "open",
    label: "Open",
    icon: "file"
  },
  "new-folder": {
    id: "new-folder",
    label: "New folder",
    icon: "new-folder"
  },
  rename: {
    id: "rename",
    label: "Rename",
    icon: "pencil"
  },
  export: {
    id: "export",
    label: "Export as ZIP",
    icon: "export"
  },
  delete: {
    id: "delete",
    label: "Delete",
    icon: "trash",
    intent: "danger"
  }
} satisfies Record<AssetAction, AssetMenuItem>;

interface AssetMenuItem extends ContextMenuItem {
  id: AssetAction;
}

export function assetMenu(
  selection: AssetSelection,
  kinds: AssetKindSet
): ContextMenuEntry[] {
  if (selection.asset !== null) {
    return [
      kItems.open,
      "separator",
      kItems.rename,
      kItems.export,
      "separator",
      kItems.delete
    ];
  }

  const creation: ContextMenuEntry[] = [
    kItems["new-folder"],
    {
      id: "new-asset",
      label: "New asset",
      icon: "plus",
      items: newAssetMenu(kinds)
    }
  ];
  if (selection.isEmpty) {
    return creation;
  }
  if (selection.isFolder) {
    return [
      ...creation,
      "separator",
      kItems.rename,
      "separator",
      kItems.delete
    ];
  }

  return [kItems.delete];
}

export function newAssetMenu(
  kinds: AssetKindSet
): ContextMenuItem[] {
  return kinds.entries.map((entry) => {
    return {
      id: newAssetAction(entry.kind),
      label: entry.label,
      icon: kinds.iconFor(entry.kind)
    };
  });
}
