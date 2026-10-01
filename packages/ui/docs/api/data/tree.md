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
| `requireSelection` | `boolean` | `false` |
| `reorderable` | `boolean` | `false` |
| `rowDrag` | `boolean` | `false` |
| `renamable` | `boolean` | `false` |
| `activateOnDoubleClick` | `boolean` | `false` |
| `indentGuides` | `boolean` | `false` |
| `acceptDrop` | `TreeDropAccept \| null` | `null` |

The component does not mutate these arrays after user input. Consumers write
event details back to the relevant property.

Clicking the empty area below the rows emits `jolly-select` with an empty
list. `requireSelection` (attribute `require-selection`) disables that, and
Ctrl+click no longer removes the last selected row. It only filters user
input: an empty `selected` set by the consumer is still rendered as is.

| Event | Detail |
|---|---|
| `jolly-select` | `{ selected }` |
| `jolly-activate` | `{ id }` |
| `jolly-activate-swatch` | `{ id }` |
| `jolly-context-request` | `{ id, x, y }` |
| `jolly-toggle-expand` | `{ id, expanded }` |
| `jolly-toggle-visible` | `{ id, visible }` |
| `jolly-toggle-lock` | `{ id, locked }` |
| `jolly-rename` | `{ id, name }` |
| `jolly-reparent` | `{ movedIds, targetId, where }` |

Arrow keys navigate visible rows. Enter activates a row. When reordering is
enabled, Space enters keyboard move mode, Enter commits, and Escape cancels.
Rename, pointer move, and keyboard move are mutually exclusive interaction
modes. Starting or settling one always returns the component to an idle mode.

Pointer gestures capture immediately, even when whole-row dragging is waiting
for its movement threshold. Escape, pointer cancellation, lost capture, and
component disconnection cancel without emitting `jolly-reparent`.

A reorderable row ends with a drag grip, exposed as the `grip` part. The grip
drags on the first movement and never scrolls, so it stays useful on touch
screens even with `rowDrag`. A tree used with a mouse whose rows drag whole
can hide it:

```css
jolly-tree::part(grip) {
  display: none;
}
```

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
knowledge. The tree does not deduplicate, order or cap badges.

```ts
node.badges = peersOn(node.id).map((peer) => ({
  color: peer.color,
  title: peer.name
}));
```

`title` fills both the tooltip and the dot's accessible label. Rows with an
empty or absent list render no badge container at all.

## Sampling a property with a swatch

`TreeNode.swatch` draws one small square after the detail and before the
badges, sampling a property the row's object owns, such as a material. `color`
fills it with any CSS colour, and a checkerboard shows through a translucent
one. `ring` outlines it in a second colour. `title` is its tooltip and
accessible name.

```ts
node.swatch = material === null ?
  { title: "Add material" } :
  { title: "Material: Glass", color: "#dff4ff73" };
```

A swatch without `color` is empty: a dashed square shown only on a hovered or
selected row. Clicking a swatch emits `jolly-activate-swatch` and neither
selects nor renames the row, so a consumer opens the property's editor there.
Unlike a badge, a swatch is a click target. It is not a tab stop: the keyboard
reaches the same editor through the row. A row has at most one swatch.

## Showing a row detail

`TreeNode.detail` is a short muted text drawn after the label, before the
badges, and never truncated. Use it for a count or a status. An empty or
absent value renders nothing.

```ts
node.detail = `${layer.voxelCount} voxels`;
```

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

A tree whose rows open something on double-click, like a file browser, sets
`activateOnDoubleClick`: double-click then always emits `jolly-activate`, and
renaming starts from F2 or from `beginRename(id)`, for a toolbar action.

```ts
tree.activateOnDoubleClick = true;
renameButton.addEventListener("click", () => {
  tree.beginRename(tree.selected[0]);
});
```

`beginRename` returns `false` and does nothing when the row does not opt in
or another interaction (a rename, a drag, a keyboard move) is in progress.

## Opening a row menu

A row's `contextmenu` event, from a right-click or from the browser's keyboard
shortcut on a focused row (Shift+F10 or the menu key), emits
`jolly-context-request` with the row `id` and a point in viewport pixels: the
pointer, or the row's bottom-left corner from the keyboard. A host that cancels
F-key defaults, such as a game keyboard, also cancels that shortcut. A right-click on
the empty area below the rows emits it with `id: null` and changes no
selection, for actions on the tree itself such as adding a root node; a
consumer without such actions ignores it. The tree renders
no menu. The consumer fills a
[`jolly-context-menu`](../containers/context-menu.md) and opens it there.

```ts
tree.addEventListener("jolly-context-request", (event) => {
  const { id, x, y } = event.detail;
  menu.items = id === null ? treeActions : actionsFor(id);
  menu.openAt(x, y);
});
```

Before emitting, the tree prevents the browser menu, emits `jolly-select` for
the row unless it is already selected, so a right-click inside a
multi-selection keeps it, and focuses the row so the menu returns focus there.
A menu action can call `beginRename(id)` directly. While a row is being
renamed or moved, a right-click does nothing, and the text field keeps the
browser menu.

## Showing parent/child indent guides

`indentGuides` draws one vertical line per ancestor level, centered under that
ancestor's expand toggle, purely from CSS. Each row only paints guides across its
own indent width, so the lines never reach into the toggle or label. Override
`--jolly-tree-guide-color` to change their color and `--jolly-tree-indent` to
change the spacing between them (defaults to 16px).

## Row layout

A row with children starts with its expand toggle, outside the hover and
selection highlight. A row without children reserves the same width inside the
highlight, so icons stay aligned across a level and the highlight reaches the
row's start. When no node has children, that space is dropped.

The highlight has an inner inline padding on both sides, set by
`--jolly-tree-row-padding-inline` (defaults to `--jolly-space-1`). The row adds
no padding of its own on its end side.

Node icons are 12px square; `--jolly-tree-icon-size` changes that, for
example to 16px for [illustrated glyphs](../icon/registry.md#illustrated-glyphs).
