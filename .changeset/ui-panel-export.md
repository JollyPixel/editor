---
"@jolly-pixel/pixel-draw.renderer": minor
---

Move the demo's Lit UI (`PixelDrawPanel`, `ModeRail`, `ColorPickerRail`, `ColorSwatch`) from `examples/` into `src/ui/`, exported as `@jolly-pixel/pixel-draw.renderer/ui`. `<pixel-draw-panel>` is now a reusable drop-in component instead of demo-only code — see `docs/ui/PixelDrawPanel.md`. `lit` and `vanilla-picker` moved from `devDependencies` to `dependencies` accordingly.
