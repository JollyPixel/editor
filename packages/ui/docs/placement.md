# Placement and resizing

Placement wrappers keep content independent from where it appears. Put the same `jolly-pane`
inside a Dock or Floating wrapper.

## Dock

```html
<jolly-dock side="left" collapsible min-size="160" max-size="480">
  <jolly-pane title="Layers">...</jolly-pane>
</jolly-dock>
```

`side` accepts `left`, `right`, `top`, or `bottom`. The inward separator resizes with pointer
input or the relevant arrow keys: 8px normally and 32px with Shift. Double-click or Enter toggles
a collapsible Dock. Size and collapsed state persist.

Dock emits `jolly-resize` while resizing and `jolly-resize-end` after pointer, keyboard, or
collapse changes. Both carry `{ width, height, collapsed }`.

Dock chrome is intentionally flush: a slotted Pane loses its border radius and shadow while it
is docked. The inward 4px separator uses a soft accent-blue surface with a dotted grip and a
slightly stronger accent treatment while interacting. Floating Panes retain their raised,
rounded treatment and quieter fine-line resize handles on their right and bottom edges.

## Floating

```html
<jolly-floating x="8" y="8" width="320" height="360">
  <jolly-pane title="Inspector">...</jolly-pane>
</jolly-floating>
```

Floating uses fixed viewport coordinates. Drag the Pane title to move; use the right and bottom
separators to resize. It clamps on connection, movement, resize, and viewport resize. An
oversized axis anchors at zero so the leading title stays reachable.

Position and size persist. Pointer interaction and focus raise a Floating instance within its
current document or shadow root; a consumer-supplied inline `z-index` takes precedence and stack
order itself is not persisted.

Movement emits `jolly-move` and `jolly-move-end` with `{ x, y }`. Resize events match Dock.

Both wrappers delegate resize calculation, bounds, keyboard behavior, and lifecycle cleanup to
`@jolly-pixel/resize-handle`.
