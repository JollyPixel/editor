// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";

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
