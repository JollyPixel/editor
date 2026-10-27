## 📌 About

Private workspace for code that several asset workspaces share: the ordered tree behind scene actors and voxel-model nodes and materials, `InvalidEntryError`, sibling-slot helpers, `NameSet`, `randomId` and a base64 codec.

It has no dependencies and imports nothing from the server, so both browser and server code can use it. Server helpers for asset kinds (`JsonAssetFile`, `arbitrated`, `SNAPSHOT_OPTIONS_SCHEMA`) live in `@jolly-pixel/asset-server`.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.common build
```

The asset workspaces load the built `dist/` output, so rebuild after a change before testing them.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.common test
$ pnpm --filter @jolly-pixel/asset.common lint
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
