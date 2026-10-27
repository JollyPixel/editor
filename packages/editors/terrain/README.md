<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Private editor workspace for [`@jolly-pixel/asset.terrain`][asset-terrain] heightfield terrains, drawn by `@jolly-pixel/terrain.renderer` and booted through [`@jolly-pixel/editor.host`][editor-host].

The [ROADMAP][roadmap] lists what lands next. Design notes live in `docs/`:

- [Design](./docs/design.md): decisions, grid, LoD, data formats and package layout.
- [Collaboration](./docs/collaboration.md): stroke commits, proximity-based sync, asset parts, corrections and undo.
- [Brush](./docs/brush.md): how sculpt, hole and paint brushes aim, shape and write.
- [Texture](./docs/texture.md): materials and their palette, splat, texture arrays, per-material techniques and the overlays.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.terrain dev
```

The dev server seeds its assets under `assets/`; delete that directory to seed them again.

`window.terrainEditor` exposes the editor from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.terrain test
$ pnpm --filter @jolly-pixel/editor.terrain typecheck
$ pnpm --filter @jolly-pixel/editor.terrain lint
$ pnpm exec playwright install chromium
$ pnpm --filter @jolly-pixel/editor.terrain test:e2e
```

Keep the Playwright suite on one worker and a `deviceScaleFactor` of 0.5: the collaboration tests render three editors with software WebGL, and more workers or pixels make them time out on CI.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[roadmap]: ./ROADMAP.md
[contributing]: ../../../CONTRIBUTING.md
[asset-terrain]: ../../assets/terrain/README.md
[editor-host]: ../host/README.md
