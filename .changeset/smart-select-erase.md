---
"@jolly-pixel/pixel-draw.renderer": minor
---

Fix a select-mode regression where moving, deleting, or rotating/flipping a selection vacated its footprint with a flat erase color (fully transparent by default), leaving a jarring hole the size of the whole selection rectangle instead of just the drawn content. The vacated footprint is now filled with the most common color among its surrounding pixels, blending into the artwork; `select.eraseColor` still works as an explicit override, and falls back to fully transparent only when no in-bounds neighbors exist.
