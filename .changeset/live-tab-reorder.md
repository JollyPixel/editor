---
"@jolly-pixel/ui": minor
---

Dragging a `jolly-tabs` or `jolly-pane-group` tab slides the other tabs aside live and glides the tab into its slot on drop, in place of the drop zone and insertion line; `jolly-tabs` exposes a `tab-dragging` part.
Add `SlidingReorder`, `LiveReorder`, the `live` alternative to a drag stack's `line`, the `lifted` argument of `Dock.dropStacks()` and `PaneGroup.liftTab()`.
Add the `suppressClick` option of `startPointerDragSession()`, so releasing a dragged tab no longer selects it; reordering a pane-group tab keeps the shown pane.
