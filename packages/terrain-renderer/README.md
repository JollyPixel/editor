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

With `overlay` set to `"chunks"` or `"lod"`, or `revealChunks` set to `true`
over any other overlay, a line is drawn on every chunk border.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../CONTRIBUTING.md
