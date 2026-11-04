## 📌 About

Private editor workspace for `@jolly-pixel/asset.model` models, booted through `@jolly-pixel/editor.host`. It previews a `.glb`, `.gltf`, `.fbx` or `.obj` file and plays its animation clips; it never edits the model.

- The viewport orbits the model, framed when it loads, above a finite grid sized to the model's footprint.
- The Model pane holds the file actions, the model's counts (meshes, vertices, triangles, materials, bones) and the external files the model points to but the asset does not hold.
- The Animate pane lists the clips and plays, pauses, stops, loops and scrubs the selected one, at 0.25× to 2×.
- Replace… takes a file of the same format, so the asset path keeps matching its content. Export downloads the stored file.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.model dev
```

The dev server seeds a generated cube with a `spin` and a `bounce` clip under `assets/`; delete that directory to seed it again. Other models are imported through the studio.

`window.modelEditor.player` and `window.modelEditor.preview` expose the player and the loaded model from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.model test
$ pnpm --filter @jolly-pixel/editor.model typecheck
$ pnpm --filter @jolly-pixel/editor.model lint
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
