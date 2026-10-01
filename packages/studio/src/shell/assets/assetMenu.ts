// Import Third-party Dependencies
import type {
  ContextMenuEntry,
  ContextMenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  newAssetName,
  type AssetKindSet
} from "../../catalog/AssetKindSet.ts";
import {
  newAssetAction,
  type AssetAction,
  type AssetSelection
} from "../../catalog/AssetSelection.ts";

interface AssetMenuItem extends ContextMenuItem {
  id: AssetAction;
}

export function assetMenu(
  selection: AssetSelection,
  kinds: AssetKindSet
): ContextMenuEntry[] {
  const creation = [
    menuItem(selection, {
      id: "new-folder",
      label: "New folder",
      icon: "new-folder"
    }),
    ...newAssetMenu(kinds)
  ];
  if (selection.isEmpty) {
    return creation;
  }

  const opening: ContextMenuEntry[] = selection.asset === null ?
    [] :
    [
      menuItem(selection, {
        id: "open",
        label: "Open",
        icon: "file"
      }),
      "separator"
    ];

  return [
    ...opening,
    ...creation,
    "separator",
    menuItem(selection, {
      id: "rename",
      label: "Rename",
      icon: "pencil"
    }),
    menuItem(selection, {
      id: "export",
      label: "Export as ZIP",
      icon: "export"
    }),
    "separator",
    menuItem(selection, {
      id: "delete",
      label: "Delete",
      icon: "trash",
      intent: "danger"
    })
  ];
}

export function newAssetMenu(
  kinds: AssetKindSet
): ContextMenuItem[] {
  return kinds.entries.map((entry) => {
    return {
      id: newAssetAction(entry.kind),
      label: newAssetName(entry),
      icon: kinds.iconFor(entry.kind)
    };
  });
}

function menuItem(
  selection: AssetSelection,
  item: AssetMenuItem
): AssetMenuItem {
  return {
    ...item,
    disabled: !selection.allows(item.id)
  };
}
