---
"@jolly-pixel/pixel-draw.renderer": minor
---

Add multiplayer cursor tracking. `PixelArtCanvas` can now report your cursor with `onCursorMove` and show other players with `peerCursors`. `PixelCursorSession` sends and receives cursor updates over any compatible `NetworkChannel`, including one already used by `PixelSyncSession`. Peer colors and `UVMap` region colors now use the same `ColorPalette`.
