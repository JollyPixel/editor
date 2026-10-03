---
"@jolly-pixel/pixel-draw.renderer": minor
---

Add derived normal maps: `NormalMapConfig` settings and per UV region zones stored in documents, undoable and synced through new `normal-map-*` commands, and a lazy `NormalMap` generated per island (`IslandMap`, `NormalMapGenerator`).
`PixelArtCanvas.textureView` draws the normal map in place of the texture, read-only for pixels (`pixelsReadOnly`, `unavailableModes`), and `PixelDocument.islands` caches the island map, built from the UV regions or from host faces (`useIslandFaces`).
