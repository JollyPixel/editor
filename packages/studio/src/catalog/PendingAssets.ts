// Import Third-party Dependencies
import type { IconName } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetKindEntry } from "./AssetKindSet.ts";
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

export interface AssetDraft {
  readonly rowId: string;
  readonly path: AssetPath;
  readonly entry: AssetKindEntry;
}

export class PendingAssets {
  #entries = new Map<string, PendingRow>();
  #draft: AssetDraft | null = null;
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
    return this.#insert(path, {
      renamable: false,
      pending: status
    });
  }

  draft(
    path: AssetPath,
    entry: AssetKindEntry,
    icon: IconName
  ): string {
    if (this.#draft !== null) {
      this.remove(this.#draft.rowId);
    }
    const rowId = this.#insert(path, {
      icon,
      renamable: true
    });
    this.#draft = {
      rowId,
      path,
      entry
    };

    return rowId;
  }

  takeDraft(
    rowId: string
  ): AssetDraft | null {
    const draft = this.#draft;
    if (draft?.rowId !== rowId) {
      return null;
    }

    this.remove(rowId);
    this.#draft = null;

    return draft;
  }

  remove(
    rowId: string
  ): void {
    this.#entries.delete(rowId);
  }

  #insert(
    path: AssetPath,
    row: Omit<AssetTreeNode, "id" | "label">
  ): string {
    const id = `${kPendingNodePrefix}${++this.#count}`;
    this.#entries.set(id, {
      folderId: folderNodeId(path.parent),
      node: {
        ...row,
        id,
        label: path.name
      }
    });

    return id;
  }
}
