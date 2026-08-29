# `jolly-tree`

`jolly-tree` renders controlled hierarchical data with selection, expansion,
visibility, locking, and reparenting intents.

```ts
const tree = document.querySelector("jolly-tree");
tree.nodes = [
  {
    id: "scene",
    label: "Scene",
    children: [{ id: "camera", label: "Camera" }]
  }
];
tree.expanded = ["scene"];
```

| Property | Type | Default |
|---|---|---|
| `nodes` | `TreeNode<TData>[]` | `[]` |
| `selected` | `string[]` | `[]` |
| `expanded` | `string[]` | `[]` |
| `multiple` | `boolean` | `false` |
| `reorderable` | `boolean` | `false` |
| `rowDrag` | `boolean` | `false` |
| `renamable` | `boolean` | `false` |

The component does not mutate these arrays after user input. Consumers write
event details back to the relevant property.

| Event | Detail |
|---|---|
| `jolly-select` | `{ selected }` |
| `jolly-activate` | `{ id }` |
| `jolly-toggle-expand` | `{ id, expanded }` |
| `jolly-toggle-visible` | `{ id, visible }` |
| `jolly-toggle-lock` | `{ id, locked }` |
| `jolly-rename` | `{ id, name }` |
| `jolly-reparent` | `{ movedIds, targetId, where }` |

Arrow keys navigate visible rows. Enter activates a row. When reordering is
enabled, Space enters keyboard move mode, Enter commits, and Escape cancels.

## Renaming a row in place

`renamable` turns on inline label editing, and every row opts in for itself
with `TreeNode.renamable`, so one tree can mix rows whose label the consumer
owns with rows whose label it does not. On an opted-in row, double-click or
F2 replaces the label with a text field; Enter or blur commits, Escape
cancels, and focus returns to the row either way.

A commit emits `jolly-rename` and nothing else: the label is not written, the
same way a drop does not move a node. A blank field or a name equal to the
current label commits nothing, so a stray edit never erases a label nor sends
a redundant write. Double-click on an opted-in row renames instead of emitting
`jolly-activate`.
