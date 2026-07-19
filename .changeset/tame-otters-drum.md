---
"@jolly-pixel/pixel-draw.renderer": major
---

Rework mouse bindings so left-click paints with `brush.primary` and right-click paints with `brush.secondary` (mutually exclusive strokes), with `Ctrl`+right-click as a one-shot eyedropper into `brush.primary`.

`Brush.color()`/`colorAsString()`/`opacity` are replaced by `Brush.primary`/`Brush.secondary` (each a `BrushColor` value object with `.set()`/`.asString()`/`.opacity`), plus a new `Brush.swapColors()`. `BrushOptions.secondaryColor` seeds the initial secondary color (default white).
