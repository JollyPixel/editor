# `jolly-tree`

`jolly-tree` renders controlled hierarchical data with selection, expansion,
visibility, locking and reparenting intents.

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

## Properties

```ts
interface Tree<TData> {
  nodes: TreeNode<TData>[]; // property only
  selected: string[]; // property only
  expanded: string[]; // property only
  multiple: boolean;
  requireSelection: boolean; // attribute require-selection
  reorderable: boolean;
  rowDrag: boolean; // attribute row-drag, the whole row drags
  renamable: boolean;
  activateOnDoubleClick: boolean; // attribute activate-on-double-click
  indentGuides: boolean; // attribute indent-guides
  indentGuidesScope: "all" | "selected"; // attribute indent-guides-scope
  toggleStyle: "chevron" | "box"; // attribute toggle-style
  swatchPosition: "start" | "end"; // attribute swatch-position, default "end"
  filter: string;
  virtual: boolean;
  acceptDrop: TreeDropAccept | null; // property only
  dragOut: TreeDragOut | null; // property only
  validateRename: TreeRenameValidator | null; // property only
}
```

- The tree never writes these after user input: write event details back.
- `selected` and `expanded` compare by content. Replace the array instead of
  mutating it.
- `nodes` can be rebuilt on every change. Rows are keyed by `id` and re-render
  only when something they display changes, so `data` never re-renders a row.

## `TreeNode`

```ts
interface TreeNode<TData = unknown> {
  id: string;
  label: string;
  children?: TreeNode<TData>[]; // present, even empty, marks a branch
  collapsible?: boolean; // false: children always shown, no toggle
  selectable?: boolean; // false: a heading row, see below
  icon?: IconName;
  avatar?: PeerAvatar; // drawn in place of icon
  visible?: boolean;
  locked?: boolean;
  renamable?: boolean;
  detail?: string;
  badges?: TreeBadge[];
  swatch?: TreeSwatch;
  warning?: string;
  data?: TData;
}
```

## Events

```ts
interface DataEventMap {
  "jolly-select": { selected: string[]; };
  "jolly-activate": { id: string; };
  "jolly-activate-swatch": { id: string; };
  "jolly-context-request": { id: string | null; x: number; y: number; };
  "jolly-toggle-expand": { id: string; expanded: boolean; };
  "jolly-toggle-visible": { id: string; visible: boolean; };
  "jolly-toggle-lock": { id: string; locked: boolean; };
  "jolly-rename": { id: string; name: string; };
  "jolly-reparent": JollyReparentDetail;
}

interface JollyReparentDetail {
  movedIds: string[];
  targetId: string;
  where: "above" | "inside" | "below";
}
```

## Methods

### `beginRename(id: string): boolean`

Starts renaming a row. Returns `false` when the row does not opt in, or a
rename, drag or keyboard move is in progress.

### `applySearch(query: SearchQuery): number`

Sets `filter` from a [`SearchQuery`](../search.md#searchquery) and returns the
number of matching rows right away. It makes the tree
[`Searchable`](../search.md#searchable).

## Selection and keyboard

- Arrow keys move between visible rows and select them. Enter activates.
- Clicking the empty area below the rows emits `jolly-select` with `[]`.
- `requireSelection` stops that, and Ctrl+click no longer removes the last
  selected row. An empty `selected` set by the consumer still renders.

## Heading rows

A node with `selectable: false` is a heading. Clicking it, or pressing Enter
on it, emits `jolly-toggle-expand` and nothing else. It never emits
`jolly-select`, `jolly-activate`, `jolly-rename` or `jolly-context-request`.
Arrow keys skip it, and ArrowLeft on one of its children does nothing. In a
`reorderable` tree it has no grip and cannot be dragged.

```ts
tree.nodes = [
  {
    id: "you",
    label: "You",
    selectable: false,
    children: [{ id: "profile", label: "Profile" }]
  }
];
```

## Reordering

- With `reorderable`, each row ends with a grip (`grip` part). The grip drags
  on the first movement and never scrolls, so it works on touch screens.
- With `rowDrag`, the whole row drags past a movement threshold. A tree used
  with a mouse can then hide the grip:

```css
jolly-tree::part(grip) {
  display: none;
}
```

- Keyboard: Space starts a move, Enter commits, Escape cancels.
- Escape, pointer cancellation, lost capture and disconnection cancel without
  `jolly-reparent`.
- Below the last row, the horizontal position picks the depth: drag left,
  under an ancestor's indent, to move a nested row out to that level. The drop
  line starts at the target indent.

## Rejecting a drop

The tree refuses a drop into a node's own subtree. Other rules belong to
`acceptDrop`:

```ts
tree.acceptDrop = ({ movedIds, targetId, where }) =>
  where !== "inside" && kindOf(movedIds[0]) === kindOf(targetId);
```

- It runs on every pointer move and on commit, so keep it cheap.
- A rejected move paints no drop indicator and never emits `jolly-reparent`.

## Dragging rows out

`dragOut` lets a pointer drag of rows end on a target outside the tree, such
as another panel.

```ts
interface TreeDragOut {
  over(drag: TreeDragOutPoint): boolean;
  drop(drag: TreeDragOutPoint): void;
  leave(): void;
}

interface TreeDragOutPoint {
  movedIds: readonly string[];
  clientX: number;
  clientY: number;
}

tree.dragOut = {
  over: ({ clientX, clientY }) => contains(panel, clientX, clientY),
  drop: ({ movedIds }) => adopt(movedIds),
  leave: () => panel.classList.remove("drop-target")
};
```

- `over` runs on every pointer move of a row drag, before the tree resolves
  its own drop. Returning `true` claims the point: the tree paints no drop
  indicator there.
- Releasing on a claimed point calls `drop` with that point and emits no
  `jolly-reparent`.
- `leave` runs when the pointer moves from a claimed point to an unclaimed one,
  and when the drag is cancelled on a claimed point.
- Keyboard moves never call it.

## Renaming

`renamable` turns on inline editing. Each row also opts in with
`TreeNode.renamable`.

- Double-click or F2 opens the field. Enter or blur commits, Escape cancels.
- A commit emits `jolly-rename` only. The label is not written.
- A blank name, or the current label, commits nothing.
- On an opted-in row, double-click renames instead of activating. With
  `activateOnDoubleClick`, double-click always activates, and renaming starts
  from F2 or `beginRename(id)`.

```ts
tree.activateOnDoubleClick = true;
renameButton.addEventListener("click", () => {
  tree.beginRename(tree.selected[0]);
});
```

`validateRename` refuses a draft with a message shown under the field, or
accepts it with `null`. It runs as the user types. Enter on a refused name
keeps the field open.

```ts
tree.validateRename = ({ id, name }) =>
  siblingNamed(id, name) ? `"${name}" already exists here` : null;
```

## Opening a row menu

A right-click, Shift+F10 or the menu key emits `jolly-context-request`. The
tree renders no menu: fill a [`jolly-context-menu`](../containers/context-menu.md).

```ts
tree.addEventListener("jolly-context-request", (event) => {
  const { id, x, y } = event.detail;
  menu.items = id === null ? treeActions : actionsFor(id);
  menu.openAt(x, y);
});
```

- `x`, `y`: the pointer, or the row's bottom-left corner from the keyboard.
- `id: null` for the empty area below the rows. The selection does not change.
- On a row, the tree selects it unless already selected, focuses it, and
  prevents the browser menu.
- During a rename or a move, a right-click does nothing.

## Row content

```ts
interface TreeBadge {
  color: string;
  title?: string; // tooltip and accessible label
  icon?: IconName; // drawn in color instead of a dot
}

interface TreeSwatch {
  title: string; // tooltip and accessible name
  color?: string; // any CSS colour, empty when omitted
  ring?: string; // outline colour
}
```

Order after the label: `detail`, swatch, warning, badges.

- `detail`: short muted text, never truncated, such as a count.
- `badges`: display-only dots. The tree does not deduplicate, order or cap
  them.
- `swatch`: one square sampling a property, such as a material. A checkerboard
  shows through a translucent colour. Without `color` it is a dashed square,
  shown on hover or selection.
- Clicking a swatch emits `jolly-activate-swatch` and neither selects nor
  renames. It is not a tab stop.
- `swatch-position="start"` puts the swatch before the label, for rows that
  stand for the swatch itself.
- `warning`: the label turns to the danger colour and a warning icon carries
  the text.
- `avatar`: a [`jolly-avatar`](../peer/avatar.md) in place of `icon`, for rows
  that stand for a person.
- A long label truncates with an
  [overflow title](../interaction/README.md#overflow-titles).

```ts
node.detail = `${layer.voxelCount} voxels`;
node.badges = peersOn(node.id).map((peer) => ({
  color: peer.color,
  title: peer.name
}));
node.swatch = material === null ?
  { title: "Add material" } :
  { title: "Material: Glass", color: "#dff4ff73" };
node.warning = clashes.has(node.id) ?
  `Another block here is named ${node.label}` :
  undefined;
```

## Filtering rows

`filter` shows rows whose label contains the text, ignoring case and
diacritics, plus their ancestors.

- Ancestors stay open and lose their toggle, without changing `expanded`.
- A matching row keeps its whole subtree.
- The matched text is wrapped in a `<mark>`, the `match` part.
- Reordering and row drag are off while a filter is set.

## Virtualizing long trees

`virtual` renders only the rows near the viewport, with
[`@lit-labs/virtualizer`](https://github.com/lit/lit/tree/main/packages/labs/virtualizer).

- Give the tree a bounded height, such as `flex: 1 1 0; min-height: 0`.
  Without one, the rows keep a 150px minimum.
- It makes the first render and expanding cheaper on long trees, and each
  scroll step dearer. Leave it off for short trees.
- Keyboard navigation, `beginRename` and keyboard moves scroll an unrendered
  row into view.
- Rows update shortly after `updateComplete`.
- Set `virtual` before the first render.

## Row layout

- A branch row starts with its toggle, outside the highlight. `toggleStyle`
  picks a chevron or a plus/minus box.
- `collapsible: false` drops the toggle and keeps the children shown.
  ArrowRight and ArrowLeft then move to the first child and to the parent.
- A leaf reserves the toggle width when a sibling has one, so labels align.
- `indentGuides` draws a line from each parent to its children.
  `indentGuidesScope="selected"` draws only the lines leading to the selected
  rows.

## Styling

```css
jolly-tree {
  --jolly-tree-indent: 16px;
  --jolly-tree-row-padding-inline: var(--jolly-space-1);
  --jolly-tree-icon-size: 12px;
  --jolly-tree-avatar-size: 16px;
}
```

`--jolly-tree-guide-color` colours the indent guides.

Parts: `content` (the highlight), plus `leaf`, `branch` and `selected` on it;
`grip`, `swatch`, `match`. Rows without children can be drawn as cards:

```css
jolly-tree::part(leaf) {
  border: 1px solid var(--jolly-border);
  background: var(--jolly-surface-raised);
}
```

Raise `--jolly-tree-icon-size` to 16px for
[illustrated glyphs](../icon/registry.md#illustrated-glyphs).
