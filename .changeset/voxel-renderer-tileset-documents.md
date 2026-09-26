---
"@jolly-pixel/voxel.renderer": major
---

World documents are version 2: they store layers and tileset links only, each tileset owning a slot that namespaces its block ids. Blocks, material groups and tile size move to `TilesetDocument`, projected into a world with `projectTilesetBlock()`.
`resizeTileset`, `defaultTileSize` and version 1 loading are removed; `TiledConverter.convert()` returns `{ world, blocks }`.
