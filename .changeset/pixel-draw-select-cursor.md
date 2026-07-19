---
"@jolly-pixel/pixel-draw.renderer": patch
---

`"select"` mode now shows the same `"grab"`/`"grabbing"` cursor affordance as `"uv"` mode: `"grab"` once a selection exists (idle), `"grabbing"` while it's being dragged to a new position. Drawing a brand-new rectangle keeps the plain cursor, since that isn't a grab motion.
