// Import Third-party Dependencies
import type {
  TreeBadge,
  TreeNode
} from "@jolly-pixel/ui";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { HierarchyNode } from "../../model/index.ts";

// CONSTANTS
const kMaxBadges = 3;

export function toTreeNodes(
  nodes: readonly HierarchyNode[],
  marks: PeerMarkMap<string>
): TreeNode[] {
  return nodes.map((node) => {
    const badges = badgesOf(node.id, marks);
    const children = toTreeNodes(node.children, marks);

    return {
      id: node.id,
      label: node.name,
      renamable: true,
      ...node.kind === "folder" ? { icon: "folder" } : {},
      ...badges.length > 0 ? { badges } : {},
      ...children.length > 0 ? { children } : {}
    };
  });
}

export function collectExpandableIds(
  nodes: readonly TreeNode[]
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (
      node.children !== undefined &&
      node.children.length > 0
    ) {
      ids.push(
        node.id,
        ...collectExpandableIds(node.children)
      );
    }
  }

  return ids;
}

function badgesOf(
  id: string,
  marks: PeerMarkMap<string>
): TreeBadge[] {
  const peers = marks.get(id) ?? [];

  return peers.slice(0, kMaxBadges).map((peer) => {
    return {
      color: peer.color,
      title: peer.displayName
    };
  });
}
