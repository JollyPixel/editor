// Import Internal Dependencies
import type { TreeNode } from "./Tree.types.ts";

export interface FlatTreeRow<TData = unknown> {
  node: TreeNode<TData>;
  depth: number;
  parentId: string | null;
}

/**
 * Depth-first, visible-only flattening: a branch's children are skipped
 * unless its id is in `expanded`. Keyboard navigation and the drag zone
 * geometry both walk this list rather than the raw `nodes` tree, since a
 * collapsed branch's hidden children are not a valid nav or drop target.
 */
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

/**
 * Depth-first search across the whole tree, visible or not: reparenting and
 * the structural guard both need to reach a collapsed node.
 */
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

/**
 * True when `id` is `ancestorId` itself or sits anywhere in its subtree.
 *
 * This is the structural half of the drop guard: it needs no domain
 * knowledge, so `jolly-tree` enforces it directly rather than leaving it to
 * the consumer.
 */
export function isSelfOrDescendant<TData>(
  nodes: readonly TreeNode<TData>[],
  ancestorId: string,
  id: string
): boolean {
  if (ancestorId === id) {
    return true;
  }

  const ancestor = findNode(nodes, ancestorId);
  if (ancestor === null || ancestor.children === undefined) {
    return false;
  }

  return findNode(ancestor.children, id) !== null;
}
