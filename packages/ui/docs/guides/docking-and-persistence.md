# Docking and persistence

A `jolly-dock-layout` lets users reorder panes, move them between docks and
float them, and stores the arrangement.

## 1. Declare the layout

```html
<div class="editor-stage">
  <jolly-dock-layout storage-key="voxel-editor">
    <jolly-dock key="left" side="left">
      <jolly-pane key="hierarchy" heading="Hierarchy"></jolly-pane>
    </jolly-dock>
    <main>Viewport</main>
    <jolly-dock key="right" side="right">
      <jolly-pane key="inspector" heading="Inspector"></jolly-pane>
    </jolly-dock>
  </jolly-dock-layout>
</div>
```

- The layout has `display: contents`: your CSS places its children.
- `key` is the identity a dock or pane is stored under. Without one, it is
  derived from the pane `heading` or the dock `side`, so renaming a pane
  drops its saved place.
- Users move panes with the pointer, or with the
  [keyboard](../api/containers/dock-layout.md#keyboard-moves).

## 2. Group panes as tabs

```html
<jolly-dock key="left" side="left">
  <jolly-pane-group>
    <jolly-pane key="general" heading="General"></jolly-pane>
    <jolly-pane key="blocks" heading="Blocks"></jolly-pane>
  </jolly-pane-group>
</jolly-dock>
<jolly-dock key="right" side="right"></jolly-dock>
```

- Dropping a pane on a header or tab strip groups it. Anywhere else in a dock,
  it takes its own slot. See [drop rules](../api/containers/dock-layout.md#drop-rules).
- An empty dock takes no space until a pane lands in it.

## 3. Offer a second column

```html
<jolly-dock key="left" side="left" size="320" double>
  <jolly-pane key="blocks" heading="Blocks"></jolly-pane>
  <jolly-pane key="paint" heading="Paint" slot="secondary"></jolly-pane>
</jolly-dock>
```

Dropping a pane just past the inner edge of a `double` dock opens the column.
`slot="secondary"` starts with it open.

## 4. React to the layout

- `jolly-pane-visibility`: pause work in a pane nobody can see.
- `locked` on a pane: keep its authored place.
- `resetLayout()`: restore the authored arrangement.
- `snapshot()`: read the current [`LayoutSnapshot`](../api/containers/layout.md).

## Storage

- Panes, folders, docks, floating windows, the dock layout, theme preferences
  and stats persist through a [`StorageAdapter`](../api/storage/README.md).
- Inside a dock layout, the layout stores dock and window geometry. Folder
  state stays with its pane.
