// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type {
  IconName,
  JollyReparentDetail,
  TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { AssetPath } from "./AssetPath.ts";

// CONSTANTS
export const FOLDER_NODE_PREFIX = "folder:";
export const ASSET_NODE_PREFIX = "asset:";
const kFolderIcon: IconName = "folder";
const kCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

export interface AssetFolderData {
  type: "folder";
  path: AssetPath;
}

export interface AssetLeafData {
  type: "asset";
  id: string;
  kind: string;
  path: AssetPath;
}

export type AssetNodeData = AssetFolderData | AssetLeafData;

export type AssetTreeNode = TreeNode<AssetNodeData>;

export interface AssetTreeOptions {
  iconFor?: (kind: string) => IconName | undefined;
  detailFor?: (kind: string) => string | undefined;
  /**
   * Shows only the assets of this kind and the folders holding them.
   * Folder relocations and deletions still cover every asset under them.
   */
  kind?: string | null;
}

export interface AssetRename {
  assetId: string;
  to: string;
}

export interface AssetRelocation {
  nodeId: string;
  from: AssetPath;
  to: AssetPath;
  renames: AssetRename[];
}

export type AssetDrop = Pick<JollyReparentDetail, "targetId" | "where">;

export function folderNodeId(
  path: AssetPath
): string {
  return `${FOLDER_NODE_PREFIX}${path}`;
}

export function assetNodeId(
  assetId: string
): string {
  return `${ASSET_NODE_PREFIX}${assetId}`;
}

export class AssetTreeModel {
  static readonly EMPTY = new AssetTreeModel([]);

  readonly nodes: AssetTreeNode[];

  #index = new Map<string, AssetTreeNode>();
  #assets: AssetLeafData[] = [];

  constructor(
    records: Iterable<AssetRecordData>,
    options: AssetTreeOptions = {}
  ) {
    this.nodes = [];
    for (const record of records) {
      const data: AssetLeafData = {
        type: "asset",
        id: record.id,
        kind: record.kind,
        path: AssetPath.parse(record.source)
      };
      this.#assets.push(data);
      if (options.kind && options.kind !== record.kind) {
        continue;
      }
      this.#add(this.#folderAt(data.path.parent), {
        id: assetNodeId(record.id),
        label: data.path.name,
        icon: options.iconFor?.(record.kind),
        detail: options.detailFor?.(record.kind),
        renamable: true,
        data
      });
    }
    sortNodes(this.nodes);
  }

  node(
    nodeId: string
  ): AssetTreeNode | undefined {
    return this.#index.get(nodeId);
  }

  has(
    nodeId: string
  ): boolean {
    return this.#index.has(nodeId);
  }

  folderIds(): string[] {
    return folderIdsOf(this.nodes);
  }

  assetsUnder(
    nodeId: string
  ): AssetLeafData[] {
    const data = this.#index.get(nodeId)?.data;
    if (data === undefined) {
      return [];
    }
    if (data.type === "asset") {
      return [data];
    }

    return this.#assets.filter(
      (asset) => asset.path.isUnder(data.path)
    );
  }

  renameOf(
    nodeId: string,
    name: string
  ): AssetRelocation | null {
    const data = this.#index.get(nodeId)?.data;
    if (data === undefined) {
      return null;
    }

    const to = data.type === "asset" ?
      data.path.withNameKeepingExtension(name) :
      data.path.withName(name);

    return to.equals(data.path)
      ? null
      : this.#relocate(nodeId, data, to);
  }

  dropFolder(
    drop: AssetDrop
  ): AssetPath | null {
    const data = this.#index.get(drop.targetId)?.data;
    if (data === undefined) {
      return null;
    }
    if (drop.where === "inside") {
      return data.type === "folder" ? data.path : null;
    }

    return data.path.parent;
  }

  acceptsDrop(
    detail: JollyReparentDetail
  ): boolean {
    const folder = this.dropFolder(detail);

    return folder !== null &&
      this.#movedData(detail.movedIds).some(
        ([, data]) => this.#canMove(data, folder)
      );
  }

  movesOf(
    detail: JollyReparentDetail
  ): AssetRelocation[] {
    const folder = this.dropFolder(detail);
    if (folder === null) {
      return [];
    }

    return this.#movedData(detail.movedIds)
      .filter(([, data]) => this.#canMove(data, folder))
      .map(([nodeId, data]) => this.#relocate(
        nodeId,
        data,
        data.path.moveUnder(folder)
      ));
  }

  withLabels(
    labels: ReadonlyMap<string, string>
  ): AssetTreeNode[] {
    return labels.size === 0
      ? this.nodes
      : relabel(this.nodes, labels);
  }

  #movedData(
    movedIds: readonly string[]
  ): Array<[string, AssetNodeData]> {
    const moved: Array<[string, AssetNodeData]> = [];
    for (const nodeId of movedIds) {
      const data = this.#index.get(nodeId)?.data;
      if (data !== undefined) {
        moved.push([nodeId, data]);
      }
    }

    return moved.filter(([, data]) => !moved.some(
      ([, other]) => other.type === "folder" && data.path.isUnder(other.path)
    ));
  }

  #canMove(
    data: AssetNodeData,
    folder: AssetPath
  ): boolean {
    if (data.path.parent.equals(folder)) {
      return false;
    }

    return data.type === "asset" ||
      !(folder.equals(data.path) || folder.isUnder(data.path));
  }

  #relocate(
    nodeId: string,
    data: AssetNodeData,
    to: AssetPath
  ): AssetRelocation {
    return {
      nodeId,
      from: data.path,
      to,
      renames: this.assetsUnder(nodeId).map((asset) => {
        return {
          assetId: asset.id,
          to: asset.path.rebase(data.path, to).toString()
        };
      })
    };
  }

  #folderAt(
    path: AssetPath
  ): AssetTreeNode[] {
    if (path.isRoot) {
      return this.nodes;
    }

    const id = folderNodeId(path);
    const known = this.#index.get(id);
    if (known?.children !== undefined) {
      return known.children;
    }

    const children: AssetTreeNode[] = [];
    this.#add(this.#folderAt(path.parent), {
      id,
      label: path.name,
      icon: kFolderIcon,
      renamable: true,
      children,
      data: {
        type: "folder",
        path
      }
    });

    return children;
  }

  #add(
    siblings: AssetTreeNode[],
    node: AssetTreeNode
  ): void {
    siblings.push(node);
    this.#index.set(node.id, node);
  }
}

function relabel(
  nodes: AssetTreeNode[],
  labels: ReadonlyMap<string, string>
): AssetTreeNode[] {
  return nodes.map((node) => {
    const label = labels.get(node.id) ?? node.label;

    return node.children === undefined ?
      {
        ...node,
        label
      } :
      {
        ...node,
        label,
        children: relabel(node.children, labels)
      };
  });
}

function folderIdsOf(
  nodes: Iterable<AssetTreeNode>
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.data?.type === "folder") {
      ids.push(
        node.id,
        ...folderIdsOf(node.children ?? [])
      );
    }
  }

  return ids;
}

function sortNodes(
  nodes: AssetTreeNode[]
): void {
  nodes.sort(compareNodes);
  for (const node of nodes) {
    if (node.children !== undefined) {
      sortNodes(node.children);
    }
  }
}

function compareNodes(
  left: AssetTreeNode,
  right: AssetTreeNode
): number {
  const leftFolder = left.data?.type === "folder";
  const rightFolder = right.data?.type === "folder";
  if (leftFolder !== rightFolder) {
    return leftFolder ? -1 : 1;
  }

  return kCollator.compare(
    left.label,
    right.label
  );
}
