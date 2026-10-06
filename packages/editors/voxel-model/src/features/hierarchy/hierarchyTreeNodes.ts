// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";
import {
  peerBadges,
  type PeerMarkMap
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import {
  blockIdsUnder,
  type HierarchyNode
} from "../../model/index.ts";
import { materialSwatch } from "../../shared/materialSwatch.ts";

export function toTreeNodes(
  nodes: readonly HierarchyNode[],
  marks: PeerMarkMap<string>,
  isVisible: (id: string) => boolean
): TreeNode[] {
  return nodes.map((node) => {
    const badges = peerBadges(node.id, marks);
    const children = toTreeNodes(node.children, marks, isVisible);

    return {
      id: node.id,
      label: node.name,
      renamable: true,
      ...node.kind === "folder" ?
        {
          icon: "folder",
          ...folderVisibility(node, isVisible)
        } :
        {
          swatch: materialSwatch(node.material),
          visible: isVisible(node.id)
        },
      ...badges.length > 0 ? { badges } : {},
      ...children.length > 0 ? { children } : {}
    };
  });
}

function folderVisibility(
  folder: HierarchyNode,
  isVisible: (id: string) => boolean
): { visible?: boolean; } {
  const ids = [...blockIdsUnder(folder)];
  if (ids.length === 0) {
    return {};
  }

  return { visible: ids.some(isVisible) };
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
