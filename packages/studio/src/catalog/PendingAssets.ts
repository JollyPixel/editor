// Import Internal Dependencies
import type { AssetPath } from "./AssetPath.ts";
import {
  folderNodeId,
  type AssetTreeNode
} from "./AssetTreeModel.ts";

// CONSTANTS
const kPendingNodePrefix = "pending:";

interface PendingRow {
  readonly folderId: string;
  readonly node: AssetTreeNode;
}

export class PendingAssets {
  #entries = new Map<string, PendingRow>();
  #count = 0;

  get rows(): ReadonlyMap<string, readonly AssetTreeNode[]> {
    const rows = new Map<string, AssetTreeNode[]>();
    for (const { folderId, node } of this.#entries.values()) {
      rows.set(folderId, [...rows.get(folderId) ?? [], node]);
    }

    return rows;
  }

  add(
    path: AssetPath,
    status: string
  ): string {
    const id = `${kPendingNodePrefix}${++this.#count}`;
    this.#entries.set(id, {
      folderId: folderNodeId(path.parent),
      node: {
        id,
        label: path.name,
        renamable: false,
        pending: status
      }
    });

    return id;
  }

  remove(
    rowId: string
  ): void {
    this.#entries.delete(rowId);
  }
}
