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
| `hidden` | `hidden` | `boolean` | `false` |
| `storageKey` | `storage-key` | `string` | `""` |
| `storage` | none | `StorageAdapter` | `LocalStorageAdapter` |

`moveTo(x, y)` moves and clamps the window. `raise()` brings it above sibling
floating windows. `clampToView()` keeps it reachable. `pane()` returns its
slotted pane or `null`.

Movement emits `jolly-move` and `jolly-move-end` with `{ x, y }`. Resize events
carry `{ width, height, collapsed }`. The component exposes
`resize-handle-right`, `resize-handle-bottom`, and `resize-handle-corner` CSS
parts. A dock layout sets `dragging` while it moves the window.

## Persistence

An unmanaged window saves `x`, `y`, `width` and `height` when a move or
resize commits, and `hidden` whenever its owner changes it, then restores all
five before its first render. Its namespace is `storageKey` when set, otherwise
the page path plus the key of the pane it holds. A window inside a
`jolly-dock-layout` writes nothing itself: the layout owns its state and is
told to save instead.
