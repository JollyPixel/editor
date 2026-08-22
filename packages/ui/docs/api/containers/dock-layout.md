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
| `snapshot()` | Current `LayoutSnapshot` |

Committed placement changes emit `jolly-layout-change` with `{ snapshot }`.
The component has `display: contents`; application CSS arranges its children.
