# Data views

`jolly-tree` renders a generic tree of `{ id, label, children }` rows: drag and drop reparenting,
collapsible groups, and optional visibility/lock toggles. It knows nothing about scenes, layers or
any other domain. `jolly-list` and `jolly-search` are not built yet; see `PLAN.md`.

## Fully controlled

`nodes`, `selected` and `expanded` are consumer owned, the same as `value` on a field. The element
renders what it is given and emits an intent event on every interaction; it never mutates its own
properties. A consumer that does not write the value back on `jolly-select`/`jolly-toggle-expand`
sees the row register the click but the tree stay visually unchanged — the same accepted gotcha
that applies to every controlled element in this package.

```ts
const tree = document.querySelector("jolly-tree");
tree.nodes = [
  { id: "scene", label: "Scene", visible: true, locked: false, children: [
    { id: "camera", label: "Camera", visible: true, locked: false }
  ] }
];
tree.expanded = ["scene"];

tree.addEventListener("jolly-select", (event) => {
  tree.selected = event.detail.selected;
});
tree.addEventListener("jolly-toggle-expand", (event) => {
  const { id, expanded } = event.detail;
  tree.expanded = expanded ? [...tree.expanded, id] : tree.expanded.filter((x) => x !== id);
});
```

## Node shape

```ts
interface TreeNode<TData = unknown> {
  id: string;
  label: string;
  children?: TreeNode<TData>[];
  icon?: IconName;
  visible?: boolean;
  locked?: boolean;
  data?: TData;
}
```

Structural, the same way `Vec3Like` is: a consumer's own domain object works as-is as long as the
shape matches. `children` being present, even as an empty array, is what marks a row as a branch
that accepts an "inside" drop; a leaf omits the property entirely. `visible` and `locked` render an
eye/lock toggle only when the property is defined on that node — a tree with no visibility concept
renders no dead icons. `icon` renders a leading glyph next to the label, from the same registry
`jolly-icon` and every other control draw from — built-in names or one registered with
`registerIcon`. `data` carries whatever else a row needs; `jolly-tree` never reads it.

## Selection

`multiple` enables Ctrl/Cmd-click to toggle a row and Shift-click to select the contiguous sibling
range from the last anchored row. Both modifiers are a no-op across two different sibling groups —
a Shift or Ctrl click on a row that does not share a parent with the current selection changes
nothing, since a range or a toggle spanning two groups has no single coherent order. Without
`multiple`, every click replaces the selection outright regardless of modifiers.

## Drag and drop reparenting

Pointer driven, through each row's drag handle (visible when `reorderable` is set), not native
HTML5 drag and drop — consistent with `jolly-folder` and `jolly-pane` elsewhere in this package,
and the reason a keyboard equivalent exists at all (native `dragstart`/`dragover` has none).
Hovering the top quarter of a row previews "above", the bottom quarter previews "below", and the
middle half previews "inside" — on every row, leaf or branch. A leaf having no children today is
current state, not a permanent incapacity: dropping "inside" one is exactly how it becomes a
branch. A domain with nodes that truly can never accept a child rejects that itself, the same way
any other domain veto works. Escape cancels mid-drag.

Set `row-drag` alongside `reorderable` to let a drag start from anywhere on the row, not only its
grip — the whole-row drag `arbor` had. It arms past a small movement threshold so a plain click
still selects the row; the grip has no such threshold and arms immediately, since starting a drag
is the only thing it is for.

The event carries the drop location, not an already-computed tree:

```ts
interface JollyReparentDetail {
  movedIds: string[];
  targetId: string;
  where: "above" | "inside" | "below";
}
```

This is deliberate: `jolly-tree` enforces the *structural* invariant that a node cannot be dropped
into itself or its own descendant, rejecting the drop before the event ever fires, but a *domain*
veto — a mesh that should not nest inside a particular group — is the consumer's job, since the
component has no way to know it. `resolveReparent(nodes, movedIds, targetId, where)` is a pure,
exported function that computes the common case:

```ts
tree.addEventListener("jolly-reparent", (event) => {
  tree.nodes = resolveReparent({ nodes: tree.nodes, ...event.detail });
});
```

A consumer that wants a veto calls `canDrop` itself, or inspects the detail before applying
`resolveReparent`.

### Keyboard reparenting

The drag handle is pointer-only. A row's own roving tabindex is the keyboard entry point instead:
Space arms move mode for the focused row (or the current multi-selection, if the focused row is
part of it), Up/Down move a cursor over the other visible rows, Left/Right cycle the drop location
between "above", "inside" and "below", Enter commits, Escape cancels.
This scales to many rows better than a separately focusable grip per row would.

## Keyboard navigation

Arrow Up/Down move the roving selection by one visible row. Right expands a collapsed branch, or
moves into its first child when already expanded; Left collapses an expanded branch, or moves to
its parent when already collapsed or on a leaf. Enter emits `jolly-activate`, mirroring double
click. All of it goes through the same controlled `jolly-select`/`jolly-toggle-expand` events as a
pointer interaction — nothing here is a shortcut around the write-back contract above.
