// Import Internal Dependencies
import type { TreeNode } from "./Tree.types.ts";

export interface FlatTreeRow<TData = unknown> {
  node: TreeNode<TData>;
  depth: number;
  parentId: string | null;
}

export function hasChildren<TData>(
  node: TreeNode<TData>
): boolean {
  return node.children !== undefined && node.children.length > 0;
}

export function flattenVisible<TData>(
  nodes: readonly TreeNode<TData>[],
  expanded: ReadonlySet<string>,
  depth = 0,
  parentId: string | null = null
): FlatTreeRow<TData>[] {
  const rows: FlatTreeRow<TData>[] = [];

  for (const node of nodes) {
    rows.push({ node, depth, parentId });
    if (node.children !== undefined && node.children.length > 0 && expanded.has(node.id)) {
      rows.push(
        ...flattenVisible(node.children, expanded, depth + 1, node.id)
      );
    }
  }

  return rows;
}

export function findNode<TData>(
  nodes: readonly TreeNode<TData>[],
  id: string
): TreeNode<TData> | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children !== undefined) {
      const found = findNode(node.children, id);
      if (found !== null) {
        return found;
      }
    }
  }

  return null;
}

export function findParentId<TData>(
  nodes: readonly TreeNode<TData>[],
  id: string,
  parentId: string | null = null
): string | null | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return parentId;
    }
    if (node.children !== undefined) {
      const found = findParentId(node.children, id, node.id);
      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
}

export function ancestorChain<TData>(
  nodes: readonly TreeNode<TData>[],
  id: string
): string[] {
  const chain = [id];
  let current = id;

  for (;;) {
    const parentId = findParentId(nodes, current);
    if (parentId === undefined || parentId === null) {
      break;
    }
    chain.unshift(parentId);
    current = parentId;
  }

  return chain;
}

export function isSelfOrDescendant<TData>(
  nodes: readonly TreeNode<TData>[],
  ancestorId: string,
  id: string
): boolean {
  if (ancestorId === id) {
    return true;
  }

  const ancestor = findNode(nodes, ancestorId);
  if (
    ancestor === null ||
    ancestor.children === undefined
  ) {
    return false;
  }

  return findNode(ancestor.children, id) !== null;
}
