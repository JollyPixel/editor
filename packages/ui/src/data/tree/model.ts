// Import Internal Dependencies
import type {
  TreeDropAccept,
  TreeDropWhere,
  TreeNode
} from "./contract.ts";

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

export interface ResolveDepthDropOptions<TData> {
  nodes: TreeNode<TData>[];
  movedIds: string[];
  rowId: string;
  clientX: number;
  containerLeft: number;
  indentUnit: number;
  where: "above" | "below";
  accept?: TreeDropAccept | null;
}

export interface DepthDropTarget {
  targetId: string;
  where: TreeDropWhere;
}

interface IndexedNode<TData> {
  node: TreeNode<TData>;
  parentId: string | null;
  depth: number;
  order: number;
  ancestors: string[];
}

/**
 * Immutable structural view of a tree, built in one depth-first traversal.
 */
export class TreeSnapshot<
  TData = unknown
> {
  readonly #nodes = new Map<string, IndexedNode<TData>>();
  readonly #visibleRows: FlatTreeRow<TData>[] = [];
  readonly hasBranches: boolean;

  constructor(
    nodes: readonly TreeNode<TData>[],
    expanded: ReadonlySet<string> = new Set()
  ) {
    let order = 0;
    let hasBranches = false;

    const visit = (
      list: readonly TreeNode<TData>[],
      parentId: string | null,
      depth: number,
      ancestors: readonly string[],
      visible: boolean
    ): void => {
      for (const node of list) {
        const nodeAncestors = [...ancestors, node.id];
        const indexed = {
          node,
          parentId,
          depth,
          order,
          ancestors: nodeAncestors
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
        hasBranches ||= isExpandable(node);

        if (node.children !== undefined) {
          visit(
            node.children,
            node.id,
            depth + 1,
            nodeAncestors,
            visible && expanded.has(node.id)
          );
        }
      }
    };

    visit(nodes, null, 0, [], true);
    this.hasBranches = hasBranches;
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

  ancestorChain(
    id: string
  ): string[] {
    return [
      ...(this.#nodes.get(id)?.ancestors ?? [id])
    ];
  }

  isSelfOrDescendant(
    ancestorId: string,
    id: string
  ): boolean {
    return this.#nodes.has(ancestorId) &&
      (this.#nodes.get(id)?.ancestors.includes(ancestorId) ?? false);
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
  return node.children !== undefined && node.children.length > 0;
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

export function ancestorChain<TData>(
  nodes: readonly TreeNode<TData>[],
  id: string
): string[] {
  return new TreeSnapshot(
    nodes
  ).ancestorChain(id);
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
  const offsetY = typeof rectOrOffset === "number" ?
    rectOrOffset :
    clientYOrHeight - rectOrOffset.top;
  const height = typeof rectOrOffset === "number" ?
    clientYOrHeight :
    rectOrOffset.height;
  if (offsetY < height / 4) {
    return "above";
  }
  if (offsetY > height * 3 / 4) {
    return "below";
  }

  return "inside";
}

export function resolveDropDepth(
  clientX: number,
  containerLeft: number,
  indentUnit: number,
  chainLength: number
): number {
  const depth = Math.floor(
    (clientX - containerLeft) / indentUnit
  );

  return Math.min(Math.max(depth, 0), chainLength - 1);
}

export function resolveEdgeDropRows<TData>(
  rows: readonly FlatTreeRow<TData>[],
  movedIds: readonly string[],
  snapshot: TreeSnapshot<TData>
): {
  firstRow: FlatTreeRow<TData> | undefined;
  lastRow: FlatTreeRow<TData> | undefined;
} {
  const availableRows = rows.filter(
    (row) => !movedIds.some(
      (movedId) => snapshot.isSelfOrDescendant(movedId, row.node.id)
    )
  );

  return {
    firstRow: availableRows[0],
    lastRow: availableRows[availableRows.length - 1]
  };
}

export interface ResolveRootDropOptions<TData> {
  nodes: TreeNode<TData>[];
  movedIds: string[];
  rowId: string;
  where: "above" | "below";
  accept?: TreeDropAccept | null;
}

export function resolveRootDropTarget<TData>(
  options: ResolveRootDropOptions<TData>,
  snapshot = new TreeSnapshot(options.nodes)
): DepthDropTarget | null {
  const {
    movedIds,
    rowId,
    where,
    accept = null
  } = options;
  const targetId = snapshot.ancestorChain(rowId)[0];

  return canDrop({
    nodes: options.nodes,
    movedIds,
    targetId,
    where,
    accept
  }, snapshot) ? {
      targetId,
      where
    } :
    null;
}

export interface ResolveEdgeDropOptions<TData> {
  nodes: TreeNode<TData>[];
  movedIds: string[];
  rows: readonly FlatTreeRow<TData>[];
  where: "above" | "below";
  accept?: TreeDropAccept | null;
}

export function resolveEdgeDropTarget<TData>(
  options: ResolveEdgeDropOptions<TData>,
  snapshot = new TreeSnapshot(options.nodes)
): DropIndicatorTarget | null {
  const {
    nodes,
    movedIds,
    rows,
    where,
    accept = null
  } = options;
  const edgeRow = where === "above" ? rows[0] : rows[rows.length - 1];
  if (edgeRow === undefined) {
    return null;
  }

  const direct = resolveRootDropTarget({ nodes, movedIds, rowId: edgeRow.node.id, where, accept }, snapshot);
  if (direct !== null) {
    return { ...direct, anchorId: edgeRow.node.id };
  }

  const { firstRow, lastRow } = resolveEdgeDropRows(rows, movedIds, snapshot);
  const fallbackRow = where === "above" ? firstRow : lastRow;
  if (fallbackRow === undefined) {
    return null;
  }

  const fallback = resolveRootDropTarget({
    nodes,
    movedIds,
    rowId: fallbackRow.node.id,
    where,
    accept
  }, snapshot);
  if (fallback === null) {
    return null;
  }

  const anchorId = movedIds.includes(edgeRow.node.id) ? edgeRow.node.id : fallbackRow.node.id;

  return { ...fallback, anchorId };
}

export function canDrop<TData>(
  options: ResolveReparentOptions<TData>,
  snapshot = new TreeSnapshot(options.nodes)
): boolean {
  const {
    movedIds,
    targetId,
    where,
    accept = null
  } = options;
  if (movedIds.includes(targetId)) {
    return false;
  }

  if (movedIds.some(
    (movedId) => snapshot.isSelfOrDescendant(movedId, targetId)
  )) {
    return false;
  }

  return accept === null || accept({
    movedIds,
    targetId,
    where
  });
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

export function resolveDepthDropTarget<TData>(
  options: ResolveDepthDropOptions<TData>,
  snapshot = new TreeSnapshot(options.nodes)
): DepthDropTarget | null {
  const {
    movedIds,
    rowId,
    clientX,
    containerLeft,
    indentUnit,
    where,
    accept = null
  } = options;
  const chain = snapshot.ancestorChain(rowId);
  const depth = resolveDropDepth(
    clientX,
    containerLeft,
    indentUnit,
    chain.length
  );
  const targetId = chain[depth];

  return canDrop({
    nodes: options.nodes,
    movedIds,
    targetId,
    where,
    accept
  }, snapshot) ? {
      targetId,
      where
    } :
    null;
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

export function resolveRename(
  currentLabel: string,
  draft: string
): string | null {
  const name = draft.trim();

  return name === "" || name === currentLabel ? null : name;
}
