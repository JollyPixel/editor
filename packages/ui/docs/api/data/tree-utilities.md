# Tree data and functions

Pure helpers over [`TreeNode`](./tree.md#treenode) arrays, exported from the
root entry point.

## Types

```ts
interface FlatTreeRow<TData = unknown> {
  node: TreeNode<TData>;
  depth: number;
  parentId: string | null;
}

type TreeDropWhere = "above" | "inside" | "below";

interface ReparentMove {
  id: string;
  parentId: string | null;
  beforeId?: string;
}

interface ResolveReparentOptions<TData> {
  nodes: TreeNode<TData>[];
  movedIds: string[];
  targetId: string;
  where: TreeDropWhere;
  accept?: TreeDropAccept | null; // same shape as jolly-tree acceptDrop
}
```

## `TreeSnapshot`

```ts
new TreeSnapshot<TData>(
  nodes: readonly TreeNode<TData>[],
  expanded?: ReadonlySet<string>
)
```

Indexes nodes, parents, depths and visible rows in one traversal. Build one
when several operations inspect the same tree.

### `placement(id: string): TreePlacement | undefined`

```ts
interface TreePlacement {
  position: number; // 1-based, among its siblings
  size: number; // sibling count
  levelHasBranches: boolean; // a sibling, or the node, can expand
}
```

`undefined` for an unknown id.

## Functions

### `hasChildren(node): boolean`

`true` when `children` is present, even empty.

### `isExpandable(node): boolean`

`true` when `children` has an entry and `collapsible` is not `false`. Such a
row gets an expand toggle.

### `flattenVisible(nodes, expanded: ReadonlySet<string>): FlatTreeRow[]`

The visible rows, with depth.

### `findNode(nodes, id): TreeNode | null`

### `findParentId(nodes, id): string | null | undefined`

`null` for a root node, `undefined` for an unknown id.

### `isSelfOrDescendant(nodes, ancestorId, id): boolean`

### `resolveSelection(options): ResolvedSelection`

The next selection after a click. With `requireSelection`, Ctrl+click keeps
the last selected row.

### `resolveRowDropZone(rect, clientY): TreeDropWhere`

`above`, `inside` or `below` a row. The older `(offsetY, height)` form still
works.

### `canDrop(options: ResolveReparentOptions): boolean`

Checks the structural rule, then `accept`.

### `resolveReparent(options: ResolveReparentOptions): TreeNode[]`

The reparented tree.

### `resolveReparentMoves(options: ResolveReparentOptions): ReparentMove[]`

The same drop as steps, for a store that moves one node at a time. Applied in
order, each step puts its node before `beforeId`, or last without one. A
refused drop gives no steps.

## Event detail types

`DataEventMap`, `JollyActivateDetail`, `JollyActivateSwatchDetail`,
`JollyContextRequestDetail`, `JollyRenameDetail`, `JollyReparentDetail`,
`JollySelectDetail`, `JollyToggleExpandDetail`, `JollyToggleLockDetail` and
`JollyToggleVisibleDetail`.
