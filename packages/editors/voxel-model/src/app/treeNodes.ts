// Import Third-party Dependencies
import type {
  TreeBadge,
  TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { PeerMarkMap } from "../collaboration/peerMarks.ts";

// CONSTANTS
const kMaxBadges = 3;

export function insertChildTreeNode(
  nodes: readonly TreeNode[],
  parentId: string | null,
  child: TreeNode
): TreeNode[] {
  if (parentId === null) {
    return [...nodes, child];
  }

  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children: [...(node.children ?? []), child] };
    }

    return node.children === undefined ?
      node :
      { ...node, children: insertChildTreeNode(node.children, parentId, child) };
  });
}

export function insertAfterTreeNode(
  nodes: readonly TreeNode[],
  siblingId: string,
  newNode: TreeNode
): TreeNode[] {
  const index = nodes.findIndex((node) => node.id === siblingId);
  if (index !== -1) {
    return [
      ...nodes.slice(0, index + 1),
      newNode,
      ...nodes.slice(index + 1)
    ];
  }

  return nodes.map((node) => (
    node.children === undefined ?
      node :
      { ...node, children: insertAfterTreeNode(node.children, siblingId, newNode) }
  ));
}

export function removeTreeNode(
  nodes: readonly TreeNode[],
  id: string
): TreeNode[] {
  const filtered = nodes.filter((node) => node.id !== id);
  if (filtered.length !== nodes.length) {
    return filtered;
  }

  return nodes.map((node) => {
    if (node.children === undefined) {
      return node;
    }

    const children = removeTreeNode(node.children, id);

    return { ...node, children: children.length > 0 ? children : undefined };
  });
}

export function relabelTreeNode(
  nodes: readonly TreeNode[],
  id: string,
  label: string
): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, label };
    }

    return node.children === undefined ?
      node :
      { ...node, children: relabelTreeNode(node.children, id, label) };
  });
}

export interface FlatModelNode {
  uuid: string;
  name: string;
  parentUuid: string | null;
  /** Absent for blocks; folders are a UI-only grouping, never in the scene graph. */
  kind?: "folder";
}

export interface FlatFolderNode {
  uuid: string;
  name: string;
  parentId: string | null;
}

export interface FlatBlockPlacement {
  blockUuid: string;
  folderId: string;
}

const kFolderNodeData = "folder";

export function isFolderNode(
  node: TreeNode
): boolean {
  return node.data === kFolderNodeData;
}

export function buildTreeFromFlatNodes(
  flatNodes: readonly FlatModelNode[]
): TreeNode[] {
  const byParent = new Map<string | null, FlatModelNode[]>();
  for (const node of flatNodes) {
    const bucket = byParent.get(node.parentUuid) ?? [];
    bucket.push(node);
    byParent.set(node.parentUuid, bucket);
  }

  function build(
    parentUuid: string | null
  ): TreeNode[] {
    return (byParent.get(parentUuid) ?? []).map((node) => {
      const children = build(node.uuid);
      const isFolder = node.kind === "folder";

      return {
        id: node.uuid,
        label: node.name || (isFolder ? "Folder" : "Block"),
        renamable: true,
        ...isFolder ? { icon: "folder" as const, data: kFolderNodeData } : {},
        ...children.length > 0 ? { children } : {}
      };
    });
  }

  return build(null);
}

export function mergeFolderTree(
  blocks: readonly FlatModelNode[],
  folders: readonly FlatFolderNode[],
  placements: readonly FlatBlockPlacement[]
): TreeNode[] {
  const folderOf = new Map(
    placements.map((placement) => [placement.blockUuid, placement.folderId])
  );

  const flatNodes: FlatModelNode[] = [
    ...folders.map((folder) => {
      return {
        uuid: folder.uuid,
        name: folder.name,
        parentUuid: folder.parentId,
        kind: "folder" as const
      };
    }),
    ...blocks.map((block) => {
      return {
        uuid: block.uuid,
        name: block.name,
        parentUuid: folderOf.get(block.uuid) ?? block.parentUuid
      };
    })
  ];

  return buildTreeFromFlatNodes(flatNodes);
}

export function collectTreeNodeIds(
  node: TreeNode
): string[] {
  const ids = [node.id];

  for (const child of node.children ?? []) {
    ids.push(...collectTreeNodeIds(child));
  }

  return ids;
}

export function collectExpandableIds(
  nodes: readonly TreeNode[]
): string[] {
  const ids: string[] = [];

  for (const node of nodes) {
    if (node.children !== undefined && node.children.length > 0) {
      ids.push(node.id, ...collectExpandableIds(node.children));
    }
  }

  return ids;
}

export function withBlockBadges(
  nodes: readonly TreeNode[],
  marks: PeerMarkMap<string>
): TreeNode[] {
  return nodes.map((node) => {
    const badges = badgesOf(node, marks);
    const children = node.children === undefined
      ? undefined
      : withBlockBadges(node.children, marks);

    return {
      ...node,
      ...badges.length > 0 ? { badges } : {},
      ...children === undefined ? {} : { children }
    };
  });
}

function badgesOf(
  node: TreeNode,
  marks: PeerMarkMap<string>
): TreeBadge[] {
  const peers = marks.get(node.id) ?? [];

  return peers.slice(0, kMaxBadges).map((peer) => {
    return {
      color: peer.color,
      title: peer.displayName
    };
  });
}
