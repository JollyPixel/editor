---
"@jolly-pixel/pixel-draw.renderer": major
---

Rename `PixelCursorSyncOptions.getLabel` to `label` and add a `color` callback,
so a host can key peer cursor colors on a stable identity field instead of the
per-connection `clientId`.
