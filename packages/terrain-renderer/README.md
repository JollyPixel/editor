<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 💃 Getting Started

This workspace-private package holds the headless terrain data (chunk
coordinates, chunks of 64×64 owned samples written by 16×16 tile, and the
`Terrain` with world-space sampling), the surface queries that match
what is drawn (`surfaceHeight` and `raycastTerrain`), and the CDLOD view that
draws it: quadtree selection,
node meshes, height texture arrays and the TSL material. The
`@jolly-pixel/terrain.renderer/engine` entry adds the `TerrainRenderer`
component. See the terrain editor [design][design] and [roadmap][roadmap].

A `SampleBlock` is a short-lived snapshot of one chunk's area: the chunk's own
samples, or samples borrowed from its eight neighbours when the chunk is
missing. A missing sample within two samples of the chunk's edge steps one
sample at a time, always in the same direction for its position, until it
lands on an existing chunk: the bottom rows step down, the right columns
right, the top rows up and the left columns left. The bottom-left corner
steps with the bottom rows, the bottom-right with the right columns, the
top-right with the top rows and the top-left with the left columns, so the
steps circle the four chunks that meet at a corner.
Other missing samples copy the outer sample of the nearest neighbour, with
equal-distance ties going to the left, below, then diagonal neighbour.

The shader reads these samples from each chunk's height apron, which is as
wide as that border, so its own neighbour order does not change what is
drawn. A chunk added next to the terrain is seeded from its sample block, so
it keeps the heights shown before the add. Because the steps do not depend on
which chunks exist, a sample that now stops on the added chunk reads the value
it stepped to before, and no other chunk's apron changes.

`Terrain.overview` is the overview map: each chunk's heights at its
2×2 points of the 32 m grid, `OVERVIEW_SPACING` samples apart. Adding,
removing or writing a chunk updates its own samples. `overview.samples(coord)`
returns a chunk's four samples, row by row, `overview.heightAt(x, z)` the
sample at a 32 m grid point, or `undefined` off the grid or without a chunk,
and `overview.interpolate(x, z)` the height between the four nearest samples.

The overview lists every chunk the document knows; only loaded chunks have
heights. `knows(coord)` tells whether a chunk exists, `has(coord)` whether it
is loaded. `addUnloadedChunk(coord, samples)` adds a chunk by its overview
samples, `loadChunk(coord, heights)` loads a known chunk and
`unloadChunk(coord)` drops its heights and keeps its samples.
`writeOverviewTile(tile, heights)` writes the samples a tile of an unloaded
chunk holds. `sampleAt` reads the interpolated overview on an unloaded chunk.

Each loaded chunk has a `splat`, a `SplatMap` of `SPLAT_TEXELS`² texels, 128
per side, 0.5 m each. A texel holds four material slots and their weights,
which sum to `SPLAT_WEIGHT_TOTAL`, 255; a new chunk is slot 0 everywhere.
`writeSplatTile(tile, splat)` writes the 32×32 texels under a tile and returns
those it replaced, `loadSplat(coord, splat)` replaces a loaded chunk's whole
map, and `writeOverviewSplatTile(tile, splat)` updates an unloaded chunk.
`overview.materials(coord)` gives the slot with the highest weight at each of
the chunk's four 32 m points; `addUnloadedChunk` and `loadChunk` take them, or
the splat, as an optional last argument, and a chunk loaded from its heights
alone keeps the materials the overview already had.

`TerrainView` draws unloaded chunks from the overview, so loaded and unloaded
ground meet without a crack. Call `chunkAdded` and `chunkRemoved` when a chunk
loads or unloads, `tilesChanged` when tiles are written, and
`overviewChanged(coords)` when unloaded chunks are added or removed or their
samples change. The view keeps node bounds between frames and recomputes only
those over the chunks these calls name, so a terrain changed without them
draws with stale bounds. It addresses chunks modulo `LOOKUP_SIZE`, 256, on
each axis and throws when two known chunks share a slot.

The view shades the surface with terrain materials. Call
`materialChanged(slot, { tiling, triplanar, stochastic, heightBlend })` when a
material appears or its tiling or `MATERIAL_TECHNIQUES` change, `materialRemoved(slot)` when it goes, and
`writeMaterialMap(slot, map, image)` with an image of exactly
`materialTextureSize` pixels per side for one of `MATERIAL_MAPS` (`albedo`,
`normal`, `orm` or `height`), or `null` to draw that map's fallback: a neutral
colour, a flat normal, occlusion 1, roughness 1 and metalness 0, and a flat
height. Each map kind lives in one texture array, albedo in sRGB and the
others linear, with an array layer per material rather than per slot; the
arrays grow as materials are added. Setting `materialTextureSize` replaces the
arrays empty, so every map has to be written again. The height map is read
only by height blending.

Images reach the arrays by a GPU copy, so no pixels stay in memory on the CPU.
The view needs a `textureCopier`, such as the `WebGPURenderer`, for that;
`TerrainRenderer` passes the engine's renderer. Without one, every map draws
its fallback.

Each chunk's splat map is uploaded to the view with the chunk; call
`splatChanged(tiles)` after painting so the view re-uploads those chunks. A
pixel blends the four materials of its splat texel by weight, and a pixel on
an unloaded chunk draws the overview's dominant material at the nearest 32 m
point.

## License

MIT

<!-- Reference-style links for DRYness -->

[design]: ../editors/terrain/docs/design.md
[roadmap]: ../editors/terrain/ROADMAP.md
