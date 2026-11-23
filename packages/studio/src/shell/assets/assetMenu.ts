// Import Third-party Dependencies
import type {
  ContextMenuEntry,
  ContextMenuItem
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import type { AssetSelection } from "../../catalog/AssetSelection.ts";
import type { AssetActions } from "./AssetActions.ts";

// CONSTANTS
const kNewAssetActionPrefix = "new-asset:";

export function parseNewAssetKind(
  id: string
): string | null {
  return id.startsWith(kNewAssetActionPrefix) ?
    id.slice(kNewAssetActionPrefix.length) :
    null;
}

export function assetMenu(
  selection: AssetSelection,
  kinds: AssetKindSet,
  actions: AssetActions
): ContextMenuEntry[] {
  if (selection.asset !== null) {
    return [
      ...actions.menuItems(["open"]),
      "separator",
      ...actions.menuItems(["rename", "replace", "export", "share"]),
      "separator",
      ...actions.menuItems(["delete"])
    ];
  }

  const creation: ContextMenuEntry[] = [
    ...actions.menuItems(["new-folder"]),
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
      ...actions.menuItems(["rename"]),
      "separator",
      ...actions.menuItems(["delete"])
    ];
  }

  return actions.menuItems(["delete"]);
}

export function newAssetMenu(
  kinds: AssetKindSet
): ContextMenuItem[] {
  return kinds.entries
    .filter((entry) => entry.creatable !== false)
    .map((entry) => {
      return {
        id: `${kNewAssetActionPrefix}${entry.kind}`,
        label: entry.label,
        icon: kinds.kindIcon(entry.kind)
      };
    });
}
