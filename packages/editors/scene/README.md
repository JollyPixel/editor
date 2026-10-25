## 📌 About

Private editor workspace for `@jolly-pixel/asset.scene` scenes, booted through `@jolly-pixel/editor.host`. A scene is a tree of actors, each with an ordered list of components (camera, light, mesh, script, voxel map) that a game plays through `@jolly-pixel/engine`.

The [SPEC](./SPEC.md) records the design and the build order; studio registration is the step left. [ARCHITECTURE](./ARCHITECTURE.md) says where each part lives.

## 💃 Getting Started

Run `pnpm run dev` in this directory. On first start the dev server seeds `assets/` with a scene (a camera, a sun and a sky light), an empty voxel map and its blockset, and opens the scene.

- **Hierarchy**: *Add* creates an actor at the root; right-click a row for *Add child*, rename, duplicate and delete. Drag a row to reparent or reorder it: the actor keeps its place in the world.
- **Inspector**: the selected actor's name, visibility and transform, then its components. *Add component* lists Camera, Light, Mesh, Script and "Voxel map…", which opens the asset picker.
- **Scene**: background color, environment map and fog.
- **Viewport**: click an actor, or its camera or light marker, to select it; Ctrl+click adds to the selection. The gizmo moves, rotates or scales the selection in one undo step.

Default keys, rebindable in the editor's preferences:

- Undo `Mod+Z`, redo `Mod+Y` or `Mod+Shift+Z`;
- duplicate `Mod+D`, delete `Delete` or `Backspace`;
- move, rotate and scale gizmo `1`, `2`, `3`; local or world axes `X`;
- frame the selection `F`.

The gizmo keys are digits because `W` moves the orbit-fly camera.

`window.sceneEditor.editing` exposes the document, history, selection and actions from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.scene test
$ pnpm --filter @jolly-pixel/editor.scene lint
```

The unit tests cover the scene binding, the shared voxel-map viewers, the editing actions and the inspector's form model. Lit elements are not mounted in unit tests; the Playwright smoke test planned in the SPEC will cover them.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
