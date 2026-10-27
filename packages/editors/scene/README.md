## 📌 About

Private editor workspace for `@jolly-pixel/asset.scene` scenes, booted through `@jolly-pixel/editor.host`.

The [ROADMAP](./ROADMAP.md) lists what comes after v1.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.scene dev
```

The dev server seeds its assets under `assets/`; delete that directory to seed them again.

The dev server loads scene component types from other workspaces only when their package is listed in `kComponentPackages` in `vite.config.ts`.

`window.sceneEditor.editing` exposes the document, history, selection and actions from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.scene test
$ pnpm --filter @jolly-pixel/editor.scene typecheck
$ pnpm --filter @jolly-pixel/editor.scene lint
$ pnpm exec playwright install chromium
$ pnpm --filter @jolly-pixel/editor.scene test:e2e
```

Unit tests do not mount Lit elements; cover panes, viewport picking and the gizmo in the Playwright suite under `test/e2e/`.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
