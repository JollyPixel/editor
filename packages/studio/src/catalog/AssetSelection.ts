// Import Internal Dependencies
import { AssetPath } from "./AssetPath.ts";
import type {
  AssetLeafData,
  AssetTreeModel
} from "./AssetTreeModel.ts";

export class AssetSelection {
  readonly nodeIds: readonly string[];
  readonly asset: AssetLeafData | null;
  readonly isFolder: boolean;
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
    this.isFolder = this.nodeIds.length === 1 && data?.type === "folder";
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
}
