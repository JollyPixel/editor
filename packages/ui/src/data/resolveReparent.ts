// Import Internal Dependencies
import { isSelfOrDescendant } from "./treeNodes.ts";
import type {
  TreeDropAccept,
  TreeDropWhere,
  TreeNode
} from "./Tree.types.ts";

export interface ResolveReparentOptions<TData> {
  nodes: TreeNode<TData>[];
  movedIds: string[];
  targetId: string;
  where: TreeDropWhere;
  accept?: TreeDropAccept | null;
}

export function canDrop<TData>(
  options: ResolveReparentOptions<TData>
): boolean {
  const {
    nodes,
    movedIds,
    targetId,
    where,
    accept = null
  } = options;

  if (movedIds.includes(targetId)) {
    return false;
  }

  const structural = movedIds.every(
    (movedId) => !isSelfOrDescendant(nodes, movedId, targetId)
  );
  if (!structural) {
    return false;
  }

  return accept === null || accept({ movedIds, targetId, where });
}

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
