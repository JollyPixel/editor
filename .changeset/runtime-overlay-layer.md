---
"@jolly-pixel/runtime": minor
---

Add `runtime.overlay` and the `overlay.container` option: the performance HUD and focus hint now follow the canvas instead of the window corner.
The HUD accepts all nine anchor positions and an `inset`, and the focus hint no longer sets a `z-index` that put it above dialogs and floating panes.
