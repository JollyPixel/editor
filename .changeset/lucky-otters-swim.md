---
"@jolly-pixel/pixel-draw.renderer": major
---

`PixelArtCanvas` (and `InputController`) no longer prefix property accessors with `get`/`set`. `getMode()`/`setMode()` → `mode`, `getFillGlobal()`/`setFillGlobal()` → `fillGlobal`, `getTextureSize()`/`setTextureSize()` → `textureSize`, `getTexture()`/`setTexture()` → `texture`, `getCamera()` → `camera`, `getZoom()` → `zoom`, `getZoomSensitivity()`/`setZoomSensitivity()` → `zoomSensitivity`, and `getParentHtmlElement()` → `parentHtmlElement` are now native `get`/`set` accessors. `getCanvas()` → `canvas()` and `getTextureCanvas()` → `textureCanvas()` are now plain methods, matching `CanvasBuffer.canvas()`/`CanvasRenderer.canvas()`. `keybindings()` → `keybindings` is now a read-only accessor; `setKeybindings(patch)` → `patchKeybindings(patch)` keeps its `set`-free verb name since it merges a partial patch rather than replacing the value (`InputController` renames the same pair identically).
