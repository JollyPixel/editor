# Placement and resizing

Placement wrappers keep a pane independent from where it appears. Place the same `jolly-pane`
inside a Dock or Floating wrapper.

## Dock

```html
<jolly-dock side="left" collapsible min-size="160" max-size="480">
  <jolly-pane title="Layers">...</jolly-pane>
</jolly-dock>
```

`side` accepts `left`, `right`, `top`, or `bottom`. The inward separator resizes by pointer
or arrow keys (Shift changes the increment). Double-click or Enter toggles a collapsible dock.
Size and collapse state persist.

A dock can hold multiple panes. `align` and `overlay` change their layout; `jolly-dock-layout`
moves panes between docks. See [containers](./containers.md).

Dock emits `jolly-resize` during resizing and `jolly-resize-end` after pointer, keyboard, or
collapse changes. Both carry `{ width, height, collapsed }`.

## Floating

```html
<jolly-floating x="8" y="8" width="320" height="360">
  <jolly-pane title="Inspector">...</jolly-pane>
</jolly-floating>
```

Floating uses fixed viewport coordinates. Drag the Pane header to move and use its right and bottom
separators to resize. Position and size persist, and a focused or interacted window rises above its
peers unless an inline `z-index` overrides it.

Inside `jolly-dock-layout`, the layout owns header dragging so a window can dock. Standalone
windows can only move. Movement emits `jolly-move` and `jolly-move-end` with `{ x, y }`;
resize events match Dock.
