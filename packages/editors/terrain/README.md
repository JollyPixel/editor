<h1 align="center">
  Terrain Editor
</h1>

<p align="center">
  Collaborative heightfield terrain editing for JollyPixel
</p>

## 📌 About

Private editor workspace for large, streamed heightfield terrains, edited by several users at once. Nothing is implemented yet: this directory holds the V1 design, and the [roadmap][roadmap] lists the order in which it lands.

V1 is split over three packages, following the voxel-map layout:

| Package | Directory | Role |
|---|---|---|
| `@jolly-pixel/asset.terrain` | `packages/assets/terrain` | Asset kind, command schemas, server arbiter, client sync, history registration |
| `@jolly-pixel/terrain.renderer` | `packages/terrain-renderer` | Headless terrain document, CDLOD view, TSL materials, engine plugin, heightmap import and export |
| `@jolly-pixel/editor.terrain` | `packages/editors/terrain` | This editor, booted through [`@jolly-pixel/editor.host`][editor-host] |

V1 also extends [`@jolly-pixel/asset-server`][asset-server] with asset parts, so an asset can be loaded chunk by chunk, Live strokes are routed by interest region in the terrain kind's server extension; [`@jolly-pixel/network`][network] does not change.

## 📚 Documents

- [Design](./docs/design.md): decisions, grid, LoD, data formats and package layout.
- [Collaboration](./docs/collaboration.md): stroke commits, proximity-based sync, asset parts, corrections and undo.
- [Brush](./docs/brush.md): how sculpt, hole and paint brushes aim, shape and write.
- [Texture](./docs/texture.md): splat layers, texture arrays, per-layer techniques and the slope overlay.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[roadmap]: ./ROADMAP.md
[contributing]: ../../../CONTRIBUTING.md
[editor-host]: ../host/README.md
[asset-server]: ../../asset-server/README.md
[network]: ../../network/README.md
