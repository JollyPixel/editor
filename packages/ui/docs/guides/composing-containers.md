# Composing containers

## Pane and folders

A [`jolly-pane`](../api/containers/pane.md) is the content surface. A
[`jolly-folder`](../api/containers/folder.md) groups rows inside it.

```html
<jolly-pane heading="Inspector" reorderable>
  <jolly-button slot="actions">Reset</jolly-button>
  <jolly-folder label="Transform">
    <jolly-vector3 label="Position"></jolly-vector3>
  </jolly-folder>
</jolly-pane>
```

## Placing panes

- [`jolly-dock`](../api/containers/dock.md): panes along one edge.
- [`jolly-floating`](../api/containers/floating.md): one pane in viewport
  coordinates.
- [`jolly-dock-layout`](../api/containers/dock-layout.md): moves panes between
  docks and windows. See [Docking and persistence](./docking-and-persistence.md).

```html
<jolly-dock side="right" align="start">
  <jolly-pane key="inspector" heading="Inspector"></jolly-pane>
</jolly-dock>
```

## Switching content

- [`jolly-pane-group`](../api/containers/pane-group.md): several panes in one
  place, behind a tab strip.
- [`jolly-tabs`](../api/containers/tabs.md): tabbed regions inside any
  content.

## Bars and overlays

- [`jolly-toolbar`](../api/containers/toolbar.md): toolbar semantics.
- [`jolly-rail`](../api/containers/rail.md): a compact strip of persistent
  controls.
- [`jolly-dialog`](../api/containers/dialog.md): a native modal with an
  `actions` slot, and [dialog helpers](../api/containers/dialog-helpers.md) for
  prompts and confirmations.
- [`jolly-context-menu`](../api/containers/context-menu.md): actions opened at
  a point.
