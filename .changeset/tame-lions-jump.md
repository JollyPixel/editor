---
"@jolly-pixel/pixel-draw.renderer": minor
---

Make the copy/paste/undo/redo/delete keyboard shortcuts configurable via `CanvasManagerOptions.keybindings`, `CanvasManager.setKeybindings()`/`getKeybindings()`. Matching now uses `KeyboardEvent.code` instead of `.key`, so shortcuts work consistently across keyboard layouts (e.g. AZERTY). As a minor side effect, matching is now exact on modifiers — Ctrl+Shift+C no longer also triggers copy, and Ctrl+Delete no longer also triggers delete.
