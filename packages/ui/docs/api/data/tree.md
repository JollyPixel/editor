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

The component does not mutate these arrays after user input. Consumers write
event details back to the relevant property.

| Event | Detail |
|---|---|
| `jolly-select` | `{ selected }` |
| `jolly-activate` | `{ id }` |
| `jolly-toggle-expand` | `{ id, expanded }` |
| `jolly-toggle-visible` | `{ id, visible }` |
| `jolly-toggle-lock` | `{ id, locked }` |
| `jolly-reparent` | `{ movedIds, targetId, where }` |

Arrow keys navigate visible rows. Enter activates a row. When reordering is
enabled, Space enters keyboard move mode, Enter commits, and Escape cancels.
