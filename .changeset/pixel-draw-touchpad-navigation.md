---
"@jolly-pixel/pixel-draw.renderer": minor
---

A touchpad pinch now zooms in paint and erase modes; only `Ctrl`+wheel with a held `Ctrl` key resizes the brush, and never while `shortcuts.panHeld` is set.
The brush highlight and other mode hover overlays hide while `panHeld` is set or a pan runs. `WindowLike` gains `keydown` and `keyup`.
