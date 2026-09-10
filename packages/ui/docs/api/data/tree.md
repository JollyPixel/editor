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
| `indentGuides` | `boolean` | `false` |
| `acceptDrop` | `TreeDropAccept \| null` | `null` |

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

## Rejecting a drop the domain does not allow

`jolly-tree` enforces one drop rule on its own: a node cannot land inside
itself or its own subtree. Every other constraint belongs to the consumer,
which sets `acceptDrop` to a `(detail: JollyReparentDetail) => boolean`.

```ts
tree.acceptDrop = ({ movedIds, targetId, where }) =>
  where !== "inside" && kindOf(movedIds[0]) === kindOf(targetId);
```

It is consulted while dragging as well as on commit, so a rejected move
paints no drop indicator and never reaches `jolly-reparent`. A predicate that
runs on every pointer move should stay cheap. The structural rule runs first,
so `acceptDrop` is never asked about a move that is already impossible.

## Promoting a nested row back out while dragging

Dropping below the last visible row is not restricted to that row's own
level. Horizontal position picks the depth: each ancestor of the last row
owns the indent band at its own depth, root leftmost through the last row's
own depth rightmost. Dragging a nested row into the band under its parent's
indent (or further left, under an outer ancestor, or straight to the
container's edge for the root) reparents it there instead of leaving it
under its original parent. The drop indicator's line starts at that band's
indent, so the target depth is visible before release.

## Marking a row with badges

`TreeNode.badges` renders a list of `{ color, title }` as small dots between
the label and the visibility toggle. The tree resolves neither field and emits
nothing for a dot: a badge is display only, and what it stands for is consumer
knowledge (see ADR-0030).

```ts
node.badges = peersOn(node.id).map((peer) => ({
  color: peer.color,
  title: peer.name
}));
```

`title` fills both the tooltip and the dot's accessible label. Rows with an
empty or absent list render no badge container at all.

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

## Showing parent/child indent guides

`indentGuides` draws one vertical line per ancestor level, centered in that
level's indent unit, purely from CSS. Each row only paints guides across its
own indent width, so the lines never reach into the toggle or label. Override
`--jolly-tree-guide-color` to change their color and `--jolly-tree-indent` to
change the spacing between them (defaults to 16px).
