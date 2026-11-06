## 📌 About

Private editor workspace for `@jolly-pixel/asset.scene` scenes, booted through `@jolly-pixel/editor.host`.

The [ROADMAP](./ROADMAP.md) lists what comes after v1.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.scene dev
```

The dev server seeds one empty scene under `assets/`; delete that directory to seed it again.

The standalone editor offers only the built-in component types (camera, light, mesh, text, script and rigid body). Component types from other packages, such as voxel maps and voxel models, come from the project file, so open the scene editor through the studio to use them. Text needs a font asset, and fonts are imported through the studio.

`window.sceneEditor.editing` exposes the document, history, selection and actions from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.scene test
$ pnpm --filter @jolly-pixel/editor.scene typecheck
$ pnpm --filter @jolly-pixel/editor.scene lint
$ pnpm --filter @jolly-pixel/editor.scene test:scenario
```

Unit tests do not mount Lit elements. `test:scenario` covers panes, viewport picking and the gizmo by playing a user story in installed Chrome; see [the scenario guide](./test/scenario/README.md).

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
