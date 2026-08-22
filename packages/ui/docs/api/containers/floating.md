# `jolly-floating`

`jolly-floating` positions one pane in viewport coordinates.

```html
<jolly-floating x="8" y="8" width="320" height="360">
  <jolly-pane heading="Inspector"></jolly-pane>
</jolly-floating>
```

| Property | Attribute | Type | Default |
|---|---|---|---|
| `x` | `x` | `number` | `8` |
| `y` | `y` | `number` | `8` |
| `width` | `width` | `number` | `320` |
| `height` | `height` | `number` | `360` |
| `minWidth` | `min-width` | `number` | `160` |
| `minHeight` | `min-height` | `number` | `80` |
| `dragging` | `dragging` | `boolean` | `false` |
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |

`moveTo(x, y)` moves and clamps the window. `raise()` brings it above sibling
floating windows. `clampToView()` keeps it reachable. `pane()` returns its
slotted pane or `null`.

Movement emits `jolly-move` and `jolly-move-end` with `{ x, y }`. Resize events
carry `{ width, height, collapsed }`. The component exposes
`resize-handle-right`, `resize-handle-bottom`, and `resize-handle-corner` CSS
parts. A dock layout sets `dragging` while it moves the window.
