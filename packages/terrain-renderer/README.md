<h1 align="center">
  terrain.renderer
</h1>

<p align="center">
  Heightfield terrain engine and renderer
</p>

## 💃 Getting Started

This workspace-private package holds the headless terrain data (chunk
coordinates, chunks of 64×64 owned samples, and the `TerrainDocument` with
world-space sampling) and the CDLOD view that draws it: quadtree selection,
node meshes, height texture arrays and the TSL material. The
`@jolly-pixel/terrain.renderer/engine` entry adds the `TerrainRenderer`
component. See the terrain editor [design][design] and [roadmap][roadmap].

## License

MIT

<!-- Reference-style links for DRYness -->

[design]: ../editors/terrain/docs/design.md
[roadmap]: ../editors/terrain/ROADMAP.md
