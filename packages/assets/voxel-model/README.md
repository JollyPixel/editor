<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Private asset workspace for `.voxelmodel.json` model trees (kind `voxelmodel`): blocks and folders, a material library and links to animation sets. Models are edited in `@jolly-pixel/editor.voxel-model`.

Browser code imports `@jolly-pixel/asset.voxel-model/client`; the package root and `@jolly-pixel/asset.voxel-model/server` pull in server dependencies.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.voxel-model build
```

Editors load the built `dist/` output, so rebuild after a change before running them.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.voxel-model test
$ pnpm --filter @jolly-pixel/asset.voxel-model lint
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
