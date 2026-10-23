---
"@jolly-pixel/color": major
"@jolly-pixel/ui": minor
"@jolly-pixel/pixel-draw.renderer": minor
---

Add OKLCH/OKHSV/OKHSL behind one `ColorSpace` object per model (replaces the `rgbToX`/`xToRgb` pairs, keeps hue on grays), mixing, harmonies, byte-color helpers, `ColorSequence` (replaces `ColorPalette`/`colorFromKey`/`goldenAngleColor`) and WCAG `contrastingColor`, plus a configurable `jolly-color-picker` (spaces, wheel, channels, harmony, shared preferences).
