// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type {
  IconName,
  TreeNode
} from "@jolly-pixel/ui";

// CONSTANTS
export const FOLDER_NODE_PREFIX = "folder:";
export const ASSET_NODE_PREFIX = "asset:";
const kSeparator = "/";
const kFolderIcon: IconName = "folder";
const kCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

export interface AssetFolderData {
  type: "folder";
  path: string;
}

export interface AssetLeafData {
  type: "asset";
  id: string;
  kind: string;
  path: string;
}

export type AssetNodeData = AssetFolderData | AssetLeafData;

export type AssetTreeNode = TreeNode<AssetNodeData>;

export interface AssetTreeOptions {
  iconFor?: (kind: string) => IconName | undefined;
  detailFor?: (kind: string) => string | undefined;
}

export interface AssetRename {
  assetId: string;
  to: string;
}

export function folderNodeId(
  path: string
): string {
  return `${FOLDER_NODE_PREFIX}${path}`;
}

export function assetNodeId(
  assetId: string
): string {
  return `${ASSET_NODE_PREFIX}${assetId}`;
}

export function assetIdOf(
  nodeId: string
): string | undefined {
  return nodeId.startsWith(ASSET_NODE_PREFIX) ?
    nodeId.slice(ASSET_NODE_PREFIX.length) :
    undefined;
}

export function folderPathOf(
  nodeId: string
): string | undefined {
  return nodeId.startsWith(FOLDER_NODE_PREFIX) ?
    nodeId.slice(FOLDER_NODE_PREFIX.length) :
    undefined;
}

export function assetName(
  source: string
): string {
  return source.slice(source.lastIndexOf(kSeparator) + 1);
}

export function assetTree(
  records: Iterable<AssetRecordData>,
  options: AssetTreeOptions = {}
): AssetTreeNode[] {
  const root: AssetTreeNode[] = [];
  const folders = new Map<string, AssetTreeNode>();

  function folderAt(
    path: string
  ): AssetTreeNode[] {
    if (path === "") {
      return root;
    }
    const known = folders.get(path);
    if (known !== undefined) {
      return known.children ?? [];
    }

    const separator = path.lastIndexOf(kSeparator);
    const children: AssetTreeNode[] = [];
    const folder: AssetTreeNode = {
      id: folderNodeId(path),
      label: path.slice(separator + 1),
      icon: kFolderIcon,
      children,
      data: {
        type: "folder",
        path
      }
    };
    folders.set(path, folder);
    folderAt(separator === -1 ? "" : path.slice(0, separator)).push(folder);

    return children;
  }

  for (const record of records) {
    const separator = record.source.lastIndexOf(kSeparator);
    const parent = folderAt(
      separator === -1 ? "" : record.source.slice(0, separator)
    );
    parent.push({
      id: assetNodeId(record.id),
      label: record.source.slice(separator + 1),
      icon: options.iconFor?.(record.kind),
      detail: options.detailFor?.(record.kind),
      data: {
        type: "asset",
        id: record.id,
        kind: record.kind,
        path: record.source
      }
    });
  }

  sortTree(root);

  return root;
}

export function folderIds(
  nodes: Iterable<AssetTreeNode>
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.data?.type === "folder") {
      ids.push(node.id, ...folderIds(node.children ?? []));
    }
  }

  return ids;
}

export function folderRenames(
  records: Iterable<AssetRecordData>,
  folderPath: string,
  to: string
): AssetRename[] {
  const prefix = `${folderPath}${kSeparator}`;
  const renames: AssetRename[] = [];
  for (const record of records) {
    if (record.source.startsWith(prefix)) {
      renames.push({
        assetId: record.id,
        to: `${to}${kSeparator}${record.source.slice(prefix.length)}`
      });
    }
  }

  return renames;
}

function sortTree(
  nodes: AssetTreeNode[]
): void {
  nodes.sort(compareNodes);
  for (const node of nodes) {
    if (node.children !== undefined) {
      sortTree(node.children);
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

  return kCollator.compare(left.label, right.label);
}
