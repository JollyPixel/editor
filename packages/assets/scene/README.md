## 📌 About

Private asset workspace for `.scene.json` scenes (kind `scene`): a tree of actors whose components can reference other assets. Scenes are edited in `@jolly-pixel/editor.scene`.

Browser code imports `@jolly-pixel/asset.scene/client`; the package root and `@jolly-pixel/asset.scene/server` pull in server dependencies.

## 🚀 Building

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/asset.scene build
```

Editors load the built `dist/` output, so rebuild after a change before running them.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/asset.scene test
$ pnpm --filter @jolly-pixel/asset.scene lint
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
