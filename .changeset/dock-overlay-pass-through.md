---
"@jolly-pixel/ui": patch
---

Keep overlay docks click-through when page CSS sets `pointer-events` on `jolly-dock`, and disable the resize strip of an empty overlay dock.
Panes, floating windows, controls and solid docks now declare `pointer-events: auto`, so they work inside a `pointer-events: none` layer.
