---
"@jolly-pixel/pixel-draw.renderer": patch
---

Fix undo/redo reactivating the selection overlay after leaving select mode: a select-edit history entry now only resyncs the selection (and its SVG overlay) when select mode is currently active, while pixels still restore regardless of mode.
