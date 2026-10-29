<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Private workspace for heightfield terrains: the headless chunk data and surface queries, and a CDLOD `TerrainView` drawn with Three.js. Terrains are edited in `@jolly-pixel/editor.terrain`, whose design notes cover the data model and rendering.

The `@jolly-pixel/terrain.renderer/engine` entry adds the `TerrainRenderer` component for `@jolly-pixel/engine`.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/terrain.renderer build
```

Editors load the built `dist/` output, so rebuild after a change before running them.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/terrain.renderer test
$ pnpm --filter @jolly-pixel/terrain.renderer lint
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Each chunk's hole mask is uploaded with the chunk as well; call
`holesChanged(tiles)` after cutting or filling. The upload is a max pyramid
of the mask: the quads, then each coarser level marking a cell when any quad
under it is a hole. A pixel is discarded when the cell of its node's spacing
is marked, so a coarse cell drops whole as soon as one quad under it is a
hole. Unloaded chunks draw no holes.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../CONTRIBUTING.md
