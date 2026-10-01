// Import Internal Dependencies
import { AssetPath } from "./AssetPath.ts";
import type {
  AssetLeafData,
  AssetTreeModel
} from "./AssetTreeModel.ts";

export const ASSET_ACTIONS = [
  "open",
  "new-folder",
  "rename",
  "export",
  "delete"
] as const;

export type AssetAction = typeof ASSET_ACTIONS[number];

export function isAssetAction(
  id: string
): id is AssetAction {
  return ASSET_ACTIONS.some((action) => action === id);
}

export class AssetSelection {
  readonly nodeIds: readonly string[];
  readonly asset: AssetLeafData | null;
  readonly folder: AssetPath;

  constructor(
    model: AssetTreeModel,
    nodeIds: Iterable<string>
  ) {
    this.nodeIds = [...nodeIds].filter((nodeId) => model.has(nodeId));

    const [first] = this.nodeIds;
    const data = first === undefined ? undefined : model.node(first)?.data;

    this.asset = this.nodeIds.length === 1 && data?.type === "asset" ?
      data :
      null;
    if (data === undefined) {
      this.folder = AssetPath.ROOT;
    }
    else {
      this.folder = data.type === "folder" ? data.path : data.path.parent;
    }
  }

  get isEmpty(): boolean {
    return this.nodeIds.length === 0;
  }

  allows(
    action: AssetAction
  ): boolean {
    switch (action) {
      case "open":
      case "export":
        return this.asset !== null;
      case "rename":
        return this.nodeIds.length === 1;
      case "delete":
        return !this.isEmpty;
      default:
        return true;
    }
  }
}
