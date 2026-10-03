# Tree data and functions

`TreeNode<TData>` has a required `id` and `label`, plus optional `children`,
`collapsible`, `icon`, `visible`, `locked`, and `data` properties. The
presence of `children` marks a branch, including an empty array.
`hasChildren(node)` reflects that branch status; `isExpandable(node)` is
`true` only when `children` holds at least one entry and `collapsible` is not
`false`, which `jolly-tree` uses to decide whether a row gets an expand
toggle. A branch with `collapsible: false` always shows its children,
whatever `expanded` holds.

`FlatTreeRow` is the flattened row shape. `TreeDropWhere` is `"above"`,
`"inside"`, or `"below"`.

`TreeSnapshot` builds node, parent, depth, ancestor, stable order, and visible
row indexes in one traversal. Create one snapshot when several operations need
to inspect the same tree structure. `hasBranches` is `true` when at least one
node, collapsed or not, has children.

The root entry point exports these pure helpers:

- `flattenVisible(nodes, expanded)` returns visible rows with depth data.
- `findNode(nodes, id)` returns a node by ID.
- `findParentId(nodes, id)` returns the parent ID, `null` for a root node, or
  `undefined` for an unknown ID.
- `isSelfOrDescendant(nodes, sourceId, targetId)` checks ancestry.
- `resolveSelection(options)` computes the next selected IDs. With
  `options.requireSelection`, Ctrl+click keeps the last selected row.
- `resolveRowDropZone(rect, clientY)` resolves `above`, `inside`, or `below`.
  The former `(offsetY, height)` call shape remains supported for compatibility.
- `canDrop(options)` checks structural reparenting constraints, then the
  optional `options.accept` domain veto.
- `resolveReparent(options)` returns a reparented tree.
- `resolveReparentMoves(options)` returns the same drop as `ReparentMove`
  steps `{ id, parentId, beforeId? }` for a store that moves one node at a
  time. Applied in order, each step lands its node before `beforeId`, a sibling
  already in place, or last without one. A refused drop gives no steps.

`ResolveReparentOptions.accept` is a `TreeDropAccept`, the same predicate
shape `jolly-tree` takes as its `acceptDrop` property.

`resolveDropIndex` and its types are documented with the
[interaction helpers](../interaction/README.md).

Tree events use `DataEventMap`, `JollyActivateDetail`, `JollyReparentDetail`,
`JollySelectDetail`, `JollyToggleExpandDetail`, `JollyToggleLockDetail`, and
`JollyToggleVisibleDetail`.
