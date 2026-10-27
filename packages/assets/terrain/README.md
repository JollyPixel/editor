<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Private asset workspace for `.terrain.json` heightfield terrains (kind `terrain`), stored as a chunk list with one heights part and one splat part per chunk. Terrains are edited in `@jolly-pixel/editor.terrain`.

Browser code imports `@jolly-pixel/asset.terrain/client`; the package root and `@jolly-pixel/asset.terrain/server` pull in server dependencies.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.terrain build
```

Editors load the built `dist/` output, so rebuild after a change before running them.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.terrain test
$ pnpm --filter @jolly-pixel/asset.terrain lint
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
