<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Private asset workspace for `.pixelart` textures (kind `pixelart`). Textures are edited in `@jolly-pixel/editor.pixel-art` and referenced by voxel maps, voxel models and scenes.

Browser code imports `@jolly-pixel/asset.pixel-art/client`; the package root and `@jolly-pixel/asset.pixel-art/server` pull in server dependencies.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.pixel-art build
```

Editors load the built `dist/` output, so rebuild after a change before running them.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.pixel-art test
$ pnpm --filter @jolly-pixel/asset.pixel-art lint
$ pnpm --filter @jolly-pixel/asset.pixel-art bench
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
