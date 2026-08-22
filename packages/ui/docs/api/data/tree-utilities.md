# Tree data and functions

`TreeNode<TData>` has a required `id` and `label`, plus optional `children`,
`icon`, `visible`, `locked`, and `data` properties. The presence of `children`
marks a branch, including an empty array.

`FlatTreeRow` is the flattened row shape. `TreeDropWhere` is `"above"`,
`"inside"`, or `"below"`.

The root entry point exports these pure helpers:

- `flattenVisible(nodes, expanded)` returns visible rows with depth data.
- `findNode(nodes, id)` returns a node by ID.
- `findParentId(nodes, id)` returns the parent ID, `null` for a root node, or
  `undefined` for an unknown ID.
- `isSelfOrDescendant(nodes, sourceId, targetId)` checks ancestry.
- `resolveSelection(options)` computes the next selected IDs.
- `resolveRowDropZone(rect, clientY)` resolves `above`, `inside`, or `below`.
- `canDrop(options)` checks structural reparenting constraints.
- `resolveReparent(options)` returns a reparented tree.

`resolveDropIndex` and its types are documented with the
[interaction helpers](../interaction/README.md).

Tree events use `DataEventMap`, `JollyActivateDetail`, `JollyReparentDetail`,
`JollySelectDetail`, `JollyToggleExpandDetail`, `JollyToggleLockDetail`, and
`JollyToggleVisibleDetail`.
