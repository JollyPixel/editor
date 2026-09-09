---
"@jolly-pixel/three": minor
---

Stop allocating peer colors in `PeerFrustumSync`. Without a `color` callback
every peer now uses `frustum.color` (which the `frustum` option finally
accepts), falling back to `PeerFrustum.Defaults.color`, and `@jolly-pixel/color`
is no longer a runtime dependency.
Export `createDefaultColorAllocator()`, previously duplicated inside
`PeerSelectionRegistry` and `PeerHoverRegistry`.
