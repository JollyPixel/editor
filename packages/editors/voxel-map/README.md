<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 📌 About

Private editor workspace built on [`@jolly-pixel/voxel.renderer`][voxel-renderer] and booted through [`@jolly-pixel/editor.host`][editor-host].

The package exports a read-only map viewer from `src/viewer/` and the `VoxelMap` scene component from `src/sceneComponents/` (`@jolly-pixel/editor.voxel-map/scene`).

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.voxel-map dev
```

The page accepts `?target=<assetId>` to open another map, `?max-fps=<n>` to cap the frame rate and `?offline` to run the asset back-end in the page (IndexedDB).

The dev server seeds its assets under `assets/`; delete that directory to seed them again.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.voxel-map test
$ pnpm --filter @jolly-pixel/editor.voxel-map typecheck
$ pnpm --filter @jolly-pixel/editor.voxel-map lint
$ pnpm --filter @jolly-pixel/editor.voxel-map test:scenario
```

`test:scenario` plays a user story in installed Chrome; see [the scenario guide](./test/scenario/README.md).

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
[voxel-renderer]: ../../voxel-renderer/README.md
[editor-host]: ../host/README.md
