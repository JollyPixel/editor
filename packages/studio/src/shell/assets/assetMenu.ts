// Import Third-party Dependencies
import type {
  ContextMenuEntry,
  ContextMenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  AssetAction,
  AssetSelection
} from "../../catalog/AssetSelection.ts";

interface AssetMenuItem extends ContextMenuItem {
  id: AssetAction;
}

export function assetMenu(
  selection: AssetSelection
): ContextMenuEntry[] {
  const newFolder = menuItem(selection, {
    id: "new-folder",
    label: "New folder",
    icon: "new-folder"
  });
  if (selection.isEmpty) {
    return [newFolder];
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
    newFolder,
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

function menuItem(
  selection: AssetSelection,
  item: AssetMenuItem
): AssetMenuItem {
  return {
    ...item,
    disabled: !selection.allows(item.id)
  };
}
