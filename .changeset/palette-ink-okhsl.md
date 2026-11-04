---
"@jolly-pixel/color": minor
"@jolly-pixel/pixel-draw.renderer": major
"@jolly-pixel/ui": minor
---

`color` adds `shadeRamp`, `sortColors`, `isRGBA8` and `PaletteFile` (GPL and Lospec hex). `pixel-draw.renderer` palettes hold 1 to 256 colors (`COLOR_PALETTE_MAX_SIZE` replaces `COLOR_PALETTE_SIZE`) and sync whole edits as `palette-replaced`; `visibleColors` lists a texture's colors.
Brushes get an `ink` (`blend` by default, `replace`, `lock-alpha`); `recordStroke` takes one color per pixel and `PixelDocument.paint(pixels, painter)` inks pixels. `jolly-color-picker` adds the `okhsl` space, an `eyedropper` button and hue wrap, paints the wheel at full value, and its wide layout gets a tool column and compact CSS hooks.
