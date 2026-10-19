// Import Internal Dependencies
import type {
  TreeDropAccept,
  TreeDropWhere,
  TreeNode
} from "./contract.ts";
import { TreeDrop } from "./TreeDrop.ts";

export interface FlatTreeRow<TData = unknown> {
  node: TreeNode<TData>;
  depth: number;
  parentId: string | null;
}

export interface ResolveSelectionOptions<TData> {
  rows: readonly FlatTreeRow<TData>[];
  clickedId: string;
  current: readonly string[];
  anchorId: string | null;
  shiftKey: boolean;
  ctrlKey: boolean;
  multiple: boolean;
  requireSelection?: boolean;
}

export interface ResolvedSelection {
  selected: string[];
  anchorId: string;
}

export interface ResolveReparentOptions<TData> {
  nodes: TreeNode<TData>[];
  movedIds: string[];
  targetId: string;
  where: TreeDropWhere;
  accept?: TreeDropAccept | null;
}

export interface ReparentMove {
  id: string;
  parentId: string | null;
  beforeId?: string;
}

export interface TreePlacement {
  position: number;
  size: number;
  levelHasBranches: boolean;
}

interface IndexedNode<TData> extends TreePlacement {
  node: TreeNode<TData>;
  parent: IndexedNode<TData> | null;
  parentId: string | null;
  depth: number;
  order: number;
}

export class TreeSnapshot<
  TData = unknown
> {
  readonly #nodes = new Map<string, IndexedNode<TData>>();
  readonly #visibleRows: FlatTreeRow<TData>[] = [];

  constructor(
    nodes: readonly TreeNode<TData>[],
    expanded: ReadonlySet<string> = new Set()
  ) {
    let order = 0;

    const visit = (
      list: readonly TreeNode<TData>[],
      parent: IndexedNode<TData> | null,
      depth: number,
      visible: boolean
    ): void => {
      const parentId = parent === null ? null : parent.node.id;
      const levelHasBranches = list.some(isExpandable);
      let position = 0;
      for (const node of list) {
        position += 1;
        const indexed: IndexedNode<TData> = {
          node,
          parent,
          parentId,
          depth,
          order,
          position,
          size: list.length,
          levelHasBranches
        };
        this.#nodes.set(node.id, indexed);

        if (visible) {
          this.#visibleRows.push({
            node,
            parentId,
            depth
          });
        }
        order += 1;

        if (node.children !== undefined) {
          visit(
            node.children,
            indexed,
            depth + 1,
            visible && isOpen(node, expanded)
          );
        }
      }
    };

    visit(nodes, null, 0, true);
  }

  get visibleRows(): readonly FlatTreeRow<TData>[] {
    return this.#visibleRows;
  }

  node(
    id: string
  ): TreeNode<TData> | null {
    return this.#nodes.get(id)?.node ?? null;
  }

  row(
    id: string
  ): FlatTreeRow<TData> | null {
    const indexed = this.#nodes.get(id);
    if (indexed === undefined) {
      return null;
    }

    return {
      node: indexed.node,
      parentId: indexed.parentId,
      depth: indexed.depth
    };
  }

  order(
    id: string
  ): number | undefined {
    return this.#nodes.get(id)?.order;
  }

  parentId(
    id: string
  ): string | null | undefined {
    return this.#nodes.get(id)?.parentId;
  }

  placement(
    id: string
  ): TreePlacement | undefined {
    const indexed = this.#nodes.get(id);

    return indexed === undefined ?
      undefined :
      {
        position: indexed.position,
        size: indexed.size,
        levelHasBranches: indexed.levelHasBranches
      };
  }

  ancestorChain(
    id: string
  ): string[] {
    let indexed = this.#nodes.get(id) ?? null;
    if (indexed === null) {
      return [id];
    }

    const chain: string[] = [];
    while (indexed !== null) {
      chain.push(indexed.node.id);
      indexed = indexed.parent;
    }

    return chain.reverse();
  }

  isSelfOrDescendant(
    ancestorId: string,
    id: string
  ): boolean {
    if (!this.#nodes.has(ancestorId)) {
      return false;
    }

    let indexed = this.#nodes.get(id) ?? null;
    while (indexed !== null) {
      if (indexed.node.id === ancestorId) {
        return true;
      }
      indexed = indexed.parent;
    }

    return false;
  }
}

export function hasChildren<TData>(
  node: TreeNode<TData>
): boolean {
  return node.children !== undefined;
}

export function isExpandable<TData>(
  node: TreeNode<TData>
): boolean {
  return node.collapsible !== false &&
    node.children !== undefined &&
    node.children.length > 0;
}

export function isHeading<TData>(
  node: TreeNode<TData> | null
): boolean {
  return node?.selectable === false;
}

export function isOpen<TData>(
  node: TreeNode<TData>,
  expanded: ReadonlySet<string>
): boolean {
  return node.collapsible === false || expanded.has(node.id);
}

export function flattenVisible<TData>(
  nodes: readonly TreeNode<TData>[],
  expanded: ReadonlySet<string>
): FlatTreeRow<TData>[] {
  return [
    ...new TreeSnapshot(nodes, expanded).visibleRows
  ];
}

export function findNode<TData>(
  nodes: readonly TreeNode<TData>[],
  id: string
): TreeNode<TData> | null {
  return new TreeSnapshot(
    nodes
  ).node(id);
}

export function findParentId<TData>(
  nodes: readonly TreeNode<TData>[],
  id: string
): string | null | undefined {
  return new TreeSnapshot(
    nodes
  ).parentId(id);
}

export function isSelfOrDescendant<TData>(
  nodes: readonly TreeNode<TData>[],
  ancestorId: string,
  id: string
): boolean {
  return new TreeSnapshot(
    nodes
  ).isSelfOrDescendant(ancestorId, id);
}

export function resolveSelection<TData>(
  options: ResolveSelectionOptions<TData>
): ResolvedSelection {
  const {
    rows,
    clickedId,
    current,
    anchorId,
    shiftKey,
    ctrlKey,
    multiple,
    requireSelection = false
  } = options;
  const clickedRow = rows.find(
    (row) => row.node.id === clickedId
  );
  if (clickedRow === undefined) {
    return {
      selected: [...current],
      anchorId: anchorId ?? clickedId
    };
  }

  if (!multiple || (!shiftKey && !ctrlKey)) {
    return {
      selected: [clickedId],
      anchorId: clickedId
    };
  }

  const anchorRow = anchorId === null ?
    undefined :
    rows.find((row) => row.node.id === anchorId);
  if (
    current.length > 0 &&
    anchorRow !== undefined &&
    anchorRow.parentId !== clickedRow.parentId
  ) {
    return {
      selected: [...current],
      anchorId: anchorRow.node.id
    };
  }

  if (shiftKey && anchorRow !== undefined) {
    const siblings = rows.filter(
      (row) => row.parentId === clickedRow.parentId
    );
    const anchorIndex = siblings.findIndex(
      (row) => row.node.id === anchorRow.node.id
    );
    const clickedIndex = siblings.findIndex(
      (row) => row.node.id === clickedId
    );
    const from = Math.min(anchorIndex, clickedIndex);
    const to = Math.max(anchorIndex, clickedIndex);

    return {
      selected: siblings
        .slice(from, to + 1)
        .filter((row) => !isHeading(row.node))
        .map((row) => row.node.id),
      anchorId: anchorRow.node.id
    };
  }

  if (ctrlKey) {
    if (current.includes(clickedId)) {
      const selected = current.filter((id) => id !== clickedId);
      if (requireSelection && selected.length === 0) {
        return {
          selected: [...current],
          anchorId: clickedId
        };
      }

      return {
        selected,
        anchorId: selected[0] ?? clickedId
      };
    }

    return {
      selected: [...current, clickedId],
      anchorId: anchorId ?? clickedId
    };
  }

  return {
    selected: [clickedId],
    anchorId: clickedId
  };
}

export function resolveRowDropZone(
  rect: Pick<DOMRect, "top" | "height">,
  clientY: number
): TreeDropWhere;
export function resolveRowDropZone(
  offsetY: number,
  height: number
): TreeDropWhere;
export function resolveRowDropZone(
  rectOrOffset: Pick<DOMRect, "top" | "height"> | number,
  clientYOrHeight: number
): TreeDropWhere {
  if (typeof rectOrOffset === "number") {
    return TreeDrop.zone(
      {
        top: 0,
        height: clientYOrHeight
      },
      rectOrOffset
    );
  }

  return TreeDrop.zone(rectOrOffset, clientYOrHeight);
}

export function canDrop<TData>(
  options: ResolveReparentOptions<TData>
): boolean {
  const drop = new TreeDrop({
    snapshot: new TreeSnapshot(options.nodes),
    movedIds: options.movedIds,
    accept: options.accept
  });

  return drop.allows(options.targetId, options.where);
}

export interface DropIndicatorRow {
  rowId: string;
  where: TreeDropWhere;
  depth: number;
}

export interface DropIndicatorTarget {
  targetId: string;
  anchorId: string;
  where: TreeDropWhere;
}

export function resolveDropIndicatorRow<TData>(
  snapshot: TreeSnapshot<TData>,
  target: DropIndicatorTarget
): DropIndicatorRow | null {
  const depth = snapshot.row(target.targetId)?.depth;

  return depth === undefined ?
    null :
    { rowId: target.anchorId, where: target.where, depth };
}

export interface RowDropStyle {
  drop: TreeDropWhere | null;
  dropIndent: string;
}

export function resolveRowDropStyle(
  nodeId: string,
  rowIndent: string,
  dropIndicator: DropIndicatorRow | null
): RowDropStyle {
  if (dropIndicator === null || dropIndicator.rowId !== nodeId) {
    return { drop: null, dropIndent: rowIndent };
  }

  return {
    drop: dropIndicator.where,
    dropIndent: `calc(${dropIndicator.depth} * var(--jolly-tree-indent, 16px))`
  };
}

export function resolveReparent<TData>(
  options: ResolveReparentOptions<TData>
): TreeNode<TData>[] {
  const {
    nodes,
    movedIds,
    targetId,
    where
  } = options;
  if (!canDrop(options)) {
    return nodes;
  }

  const movedIdSet = new Set(movedIds);
  const moved = new Map<string, TreeNode<TData>>();
  function extract(
    list: readonly TreeNode<TData>[]
  ): TreeNode<TData>[] {
    return list.flatMap((node) => {
      if (movedIdSet.has(node.id)) {
        moved.set(node.id, node);

        return [];
      }
      if (node.children === undefined) {
        return [node];
      }

      return [{
        ...node,
        children: extract(node.children)
      }];
    });
  }
  const withoutMoved = extract(nodes);
  const orderedMoved = movedIds.flatMap((id) => {
    const node = moved.get(id);

    return node === undefined ? [] : [node];
  });
  function insert(
    list: readonly TreeNode<TData>[]
  ): TreeNode<TData>[] {
    const targetIndex = list.findIndex(
      (node) => node.id === targetId
    );
    if (targetIndex !== -1) {
      if (where === "inside") {
        return list.map((node, index) => {
          if (index !== targetIndex) {
            return node;
          }

          return {
            ...node,
            children: [
              ...(node.children ?? []),
              ...orderedMoved
            ]
          };
        });
      }

      const insertAt = where === "above" ? targetIndex : targetIndex + 1;

      return [
        ...list.slice(0, insertAt),
        ...orderedMoved,
        ...list.slice(insertAt)
      ];
    }

    return list.map((node) => {
      if (node.children === undefined) {
        return node;
      }

      return {
        ...node,
        children: insert(node.children)
      };
    });
  }

  return insert(withoutMoved);
}

export function resolveReparentMoves<TData>(
  options: ResolveReparentOptions<TData>
): ReparentMove[] {
  const next = resolveReparent(options);
  if (next === options.nodes) {
    return [];
  }

  const snapshot = new TreeSnapshot(next);
  const parentId = snapshot.parentId(options.movedIds[0]) ?? null;
  const siblings = parentId === null ? next : snapshot.node(parentId)?.children ?? [];
  const moved = new Set(options.movedIds);
  const moves: ReparentMove[] = [];
  for (let index = siblings.length - 1; index >= 0; index--) {
    const { id } = siblings[index];
    const beforeId = siblings[index + 1]?.id;
    if (moved.has(id)) {
      moves.push(beforeId === undefined ? { id, parentId } : { id, parentId, beforeId });
    }
  }

  return moves;
}

export function resolveRename(
  currentLabel: string,
  draft: string
): string | null {
  const name = draft.trim();

  return name === "" || name === currentLabel ? null : name;
}

export function idListChanged(
  value: unknown,
  oldValue: unknown
): boolean {
  if (!Array.isArray(value) || !Array.isArray(oldValue)) {
    return value !== oldValue;
  }
  if (value.length !== oldValue.length) {
    return true;
  }
  for (let index = 0; index < value.length; index++) {
    if (value[index] !== oldValue[index]) {
      return true;
    }
  }

  return false;
}
