// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { HierarchyNode } from "../../model/index.ts";
import { materialSwatch } from "../../shared/materialSwatch.ts";
import { peerBadges } from "../../shared/peerBadges.ts";

export function toTreeNodes(
  nodes: readonly HierarchyNode[],
  marks: PeerMarkMap<string>
): TreeNode[] {
  return nodes.map((node) => {
    const badges = peerBadges(node.id, marks);
    const children = toTreeNodes(node.children, marks);

    return {
      id: node.id,
      label: node.name,
      renamable: true,
      ...node.kind === "folder" ?
        { icon: "folder" } :
        { swatch: materialSwatch(node.material) },
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
