# `jolly-dock-layout`

`jolly-dock-layout` coordinates pane placement across docks and floating
windows.

```html
<jolly-dock-layout storage-key="editor-layout">
  <jolly-dock key="left" side="left">
    <jolly-pane key="tools" heading="Tools"></jolly-pane>
  </jolly-dock>
</jolly-dock-layout>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |

| Method | Result |
|---|---|
| `docks()` | Docks owned by this layout |
| `panes()` | Docked and floating panes owned by this layout |
| `sync()` | Reconciles the current markup with the layout snapshot |
| `resetLayout()` | Restores the authored arrangement |
| `snapshot()` | Copy of the current `LayoutSnapshot` |
| `placement(pane)` | `PanePlacement` of a docked pane, or `null` |
| `paneVisible(pane)` | Whether the pane content is on screen |
| `showPane(pane)` | Makes a grouped pane the active tab and saves |

The snapshot is the layout's only state. Drags and keyboard moves change it
first, then the layout projects it onto docks and floating windows. Docks,
floating windows, and panes inside the layout report their own changes
through `jolly-layout-dirty`, whose detail is a `LayoutChange`. A pane that
discovers its folders emits `jolly-pane-folders` with `{ pane }` so the layout
applies their stored open state.

Saved changes emit `jolly-layout-change` with a copy of the snapshot as
`{ snapshot }`.

A dragged pane dropped on a pane header or a group tab strip joins that group
as the active tab; dropped anywhere else in a dock it takes its own slot. The
layout wraps panes that share a slot in a `jolly-pane-group`.

After every projection and reported change, each pane whose visibility changed
emits `jolly-pane-visibility` with `{ pane, visible }`. The first projection
reports every pane. A pane is visible when it floats, or when it is the active
tab of a dock that is not collapsed. A folded pane is hidden unless it is
grouped.
The component has `display: contents`; application CSS arranges its children.
