<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Private editor workspace for [`@jolly-pixel/asset.voxel-model`][asset-voxel-model] models, booted through [`@jolly-pixel/editor.host`][editor-host].

The package exports a read-only model viewer from `src/viewer/` and the `VoxelModel` scene component from `src/sceneComponents/` (`@jolly-pixel/editor.voxel-model/scene`). The component draws the model with the pixel-art texture the model links. Its runtime entry (`./runtime`) adds the same component to a game and a `voxelmodel` loader, which reads the model's build and loads its texture through the pixel-art runtime loader. The build is the model file with the transform and UV fields the stored form omits; animations do not play in a game yet.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.voxel-model dev
```

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.voxel-model test
$ pnpm --filter @jolly-pixel/editor.voxel-model lint
$ pnpm --filter @jolly-pixel/editor.voxel-model test:scenario
```

`test:scenario` builds and animates a small figure in installed Chrome, checking each step through an exported archive; see [the scenario guide](./test/scenario/README.md).

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
[asset-voxel-model]: ../../assets/voxel-model/README.md
[editor-host]: ../host/README.md
