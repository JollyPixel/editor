// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";

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

export function collectTreeNodeIds(
  node: TreeNode
): string[] {
  const ids = [node.id];

  for (const child of node.children ?? []) {
    ids.push(...collectTreeNodeIds(child));
  }

  return ids;
}
