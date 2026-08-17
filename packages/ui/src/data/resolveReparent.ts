// Import Internal Dependencies
import { isSelfOrDescendant } from "./treeNodes.ts";
import type {
  TreeDropWhere,
  TreeNode
} from "./Tree.types.ts";

export interface ResolveReparentOptions<TData> {
  nodes: TreeNode<TData>[];
  movedIds: string[];
  targetId: string;
  where: TreeDropWhere;
}

/**
 * The structural invariant a domain veto never needs to restate: a node
 * cannot land inside itself or its own subtree. Dropping "inside" a leaf is
 * exactly how it becomes a branch, so that case is not rejected here.
 */
export function canDrop<TData>(
  options: ResolveReparentOptions<TData>
): boolean {
  const { nodes, movedIds, targetId } = options;

  if (movedIds.includes(targetId)) {
    return false;
  }

  return movedIds.every(
    (movedId) => !isSelfOrDescendant(nodes, movedId, targetId)
  );
}

/**
 * Computes the tree that results from moving `movedIds` to `where` of
 * `targetId`, preserving their current relative order. Pure given a node
 * list, moved ids and a drop target — no DOM, no consumer domain knowledge.
 *
 * Returns `nodes` unchanged (same reference) when `canDrop` rejects the
 * move, so a caller can compare by identity to detect a no-op.
 */
export function resolveReparent<TData>(
  options: ResolveReparentOptions<TData>
): TreeNode<TData>[] {
  const { nodes, movedIds, targetId, where } = options;

  if (!canDrop(options)) {
    return nodes;
  }

  const movedIdSet = new Set(movedIds);
  const moved: TreeNode<TData>[] = [];

  function extract(
    list: readonly TreeNode<TData>[]
  ): TreeNode<TData>[] {
    const kept: TreeNode<TData>[] = [];

    for (const node of list) {
      if (movedIdSet.has(node.id)) {
        moved.push(node);
        continue;
      }

      kept.push(
        node.children === undefined ?
          node :
          { ...node, children: extract(node.children) }
      );
    }

    return kept;
  }

  const withoutMoved = extract(nodes);
  // Preserve the order the caller passed movedIds in, not extraction order.
  const orderedMoved = movedIds
    .map((id) => moved.find((node) => node.id === id))
    .filter((node): node is TreeNode<TData> => node !== undefined);

  function insert(
    list: readonly TreeNode<TData>[]
  ): TreeNode<TData>[] {
    const targetIndex = list.findIndex((node) => node.id === targetId);
    if (targetIndex !== -1) {
      if (where === "inside") {
        const target = list[targetIndex];

        return list.map(
          (node, index) => (index === targetIndex ?
            {
              ...target,
              children: [...(target.children ?? []), ...orderedMoved]
            } :
            node)
        );
      }

      const insertAt = where === "above" ? targetIndex : targetIndex + 1;

      return [
        ...list.slice(0, insertAt),
        ...orderedMoved,
        ...list.slice(insertAt)
      ];
    }

    return list.map(
      (node) => (node.children === undefined ?
        node :
        { ...node, children: insert(node.children) })
    );
  }

  return insert(withoutMoved);
}
