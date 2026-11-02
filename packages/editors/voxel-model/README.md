<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Private editor workspace for [`@jolly-pixel/asset.voxel-model`][asset-voxel-model] models, booted through [`@jolly-pixel/editor.host`][editor-host].

The package exports a read-only model viewer from `src/viewer/` and the `VoxelModel` scene component from `src/sceneComponents/` (`@jolly-pixel/editor.voxel-model/scene`). The component draws the model with the pixel-art texture the model links. Games cannot load voxel models yet, so it renders only in the scene editor.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.voxel-model dev
```

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.voxel-model test
$ pnpm --filter @jolly-pixel/editor.voxel-model lint
$ pnpm exec playwright install chromium
$ pnpm --filter @jolly-pixel/editor.voxel-model test:e2e
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
[asset-voxel-model]: ../../assets/voxel-model/README.md
[editor-host]: ../host/README.md
