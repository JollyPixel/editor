# Composing containers

`jolly-pane` is the content surface used by docks and floating windows.
`jolly-folder` groups rows within a pane. Tabs switch between larger content
regions.

```html
<jolly-pane heading="Inspector" reorderable>
  <jolly-button slot="actions">Reset</jolly-button>
  <jolly-folder label="Transform">
    <jolly-vector3 label="Position"></jolly-vector3>
  </jolly-folder>
</jolly-pane>
```

A dock places panes along one side of an application region:

```html
<jolly-dock side="right" align="start">
  <jolly-pane key="inspector" heading="Inspector"></jolly-pane>
</jolly-dock>
```

`jolly-floating` gives one pane viewport coordinates and resize handles.
`jolly-dock-layout` coordinates moves between docks and floating windows. See
[Docking and persistence](./docking-and-persistence.md) for that ownership
model.

`jolly-toolbar` supplies toolbar semantics. `jolly-rail` is a compact strip
for persistent controls. `jolly-dialog` wraps the native modal dialog API and
provides an `actions` slot.
