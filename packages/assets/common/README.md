Code shared by the asset workspaces

## 📌 About

Private workspace for code that several asset workspaces share: the ordered tree behind scene actors and voxel-model nodes and materials, `InvalidEntryError`, sibling-slot helpers, `NameSet` and `randomId`.

It has no dependencies and imports nothing from the server, so both browser and server code can use it. Server helpers for asset kinds (`JsonAssetFile`, `arbitrated`, `NO_OPTIONS_SCHEMA`) live in `@jolly-pixel/asset-server`.

The `./testing` entry is for the workspaces' specs and runs in Node only: `assertDeclaresSceneComponents` checks a package's `jollypixel.sceneComponents` against its `RUNTIME_COMPONENTS`, and `browserBundleInputs(entry, ...patterns)` lists the modules an esbuild browser bundle of an entry keeps that match a pattern, such as `KIND_HANDLER_INPUT` (asset-server's kind authoring code and `*AssetKind.ts` handlers). The studio's bundle spec checks that same pattern against the offline server's chunks, so a renamed handler folder fails there instead of passing every asset guard.

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
