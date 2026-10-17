// Import Third-party Dependencies
import type { IconName } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetKindSet } from "./AssetKindSet.ts";
import type { AssetPath } from "./AssetPath.ts";
import type { AssetSelection } from "./AssetSelection.ts";

// CONSTANTS
const kFolderIcon: IconName = "folder";
const kFolderLabel = "Folder";

export interface AssetIdentity {
  readonly title: string;
  readonly icon: IconName;
  readonly kindLabel: string;
  readonly location: string;
}

export interface AssetFileSummary extends AssetIdentity {
  readonly subject: "asset";
  readonly editableAssetId: string | null;
}

export interface FolderSummary extends AssetIdentity {
  readonly subject: "folder";
}

export interface ManyAssetsSummary {
  readonly subject: "many";
  readonly count: number;
}

export interface NoAssetSummary {
  readonly subject: "none";
}

export type AssetSummary =
  | AssetFileSummary
  | FolderSummary
  | ManyAssetsSummary
  | NoAssetSummary;

export const NO_ASSET_SUMMARY: NoAssetSummary = Object.freeze({
  subject: "none"
});

export function summarizeSelection(
  selection: AssetSelection,
  kinds: AssetKindSet
): AssetSummary {
  const { asset } = selection;
  if (asset !== null) {
    return {
      subject: "asset",
      title: asset.path.name,
      icon: kinds.kindIcon(asset.kind),
      kindLabel: kinds.kindLabel(asset.kind),
      location: parentLocation(asset.path),
      editableAssetId: kinds.canEdit(asset.kind) ? asset.id : null
    };
  }
  if (selection.isFolder) {
    return {
      subject: "folder",
      title: selection.folder.name,
      icon: kFolderIcon,
      kindLabel: kFolderLabel,
      location: parentLocation(selection.folder)
    };
  }
  if (selection.isEmpty) {
    return NO_ASSET_SUMMARY;
  }

  return {
    subject: "many",
    count: selection.nodeIds.length
  };
}

function parentLocation(
  path: AssetPath
): string {
  return `/${path.parent.toString()}`;
}
