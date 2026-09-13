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

The snapshot is the layout's only state. Drags and keyboard moves change it
first, then the layout projects it onto docks and floating windows. Docks,
floating windows, and panes inside the layout report their own changes
through `jolly-layout-dirty`, whose detail is a `LayoutChange`. A pane that
discovers its folders emits `jolly-pane-folders` with `{ pane }` so the layout
applies their stored open state.

Saved changes emit `jolly-layout-change` with a copy of the snapshot as
`{ snapshot }`.
The component has `display: contents`; application CSS arranges its children.
