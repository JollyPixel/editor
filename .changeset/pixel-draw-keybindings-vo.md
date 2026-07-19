---
"@jolly-pixel/pixel-draw.renderer": major
---

Extract a `Keybindings` value object (in `src/input/`) from the standalone `utils/keybindings.ts` functions. `PixelArtCanvas.keybindings` now returns this `Keybindings` instance instead of a readonly snapshot object, and `PixelArtCanvas.patchKeybindings()` is removed — use `canvas.keybindings.patch(...)` instead. The `Keybindings` record type is renamed to `KeybindingsMap` (the class now owns the `Keybindings` name).
