---
"@jolly-pixel/color": major
"@jolly-pixel/pixel-draw.renderer": patch
"@jolly-pixel/ui": patch
---

Add the immutable `Color` object (with `parseDraft` for typed text), `Gradient`, `PaletteFormat`, the picker `HueSpace`, `equalRGBA8`, `ByteColorInput` and `ColorSpace.channels`. They replace `parseColor`, `assertColor*`, `format*`, the byte `8` variants, `toRGBA8`/`fromRGBA8`, `contrastingColor`, `mixColor`, `colorRamp`, `shadeRamp`, `hsvToHsl`/`hslToHsv`, `ColorSpace.mix()`, `PaletteFile.parse()`/`serialize()`, `isOklchInGamut` and the sRGB transfer functions.
Near-gray colors now convert to HSL, HSV and HWB as grays, `Color.oklch()` round-trips 8-bit colors, and `sortColors` returns the objects it was given.
