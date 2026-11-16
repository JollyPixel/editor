## 📌 About

Private editor workspace for `@jolly-pixel/asset.environment` environments, booted through `@jolly-pixel/editor.host`.

- The Environment pane edits each section of the file: sky, sun, ambient light, reflections, fog, tone mapping, glow and voxel lighting. Dragging a number or a color previews it; releasing it stores the change.
- The viewport lights three spheres (rough, glossy and metal), a crate and a glowing block above a ground plane with the engine's `ThreeSceneEnvironment`, the one a game uses.
- Undo and redo (Ctrl+Z, Ctrl+Y) revert section changes.

Scenes pick their environment in the scene editor's Scene pane. The voxel map and voxel model editors preview a map or a model in any project environment from their view settings.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.environment dev
```

The dev server seeds `environments/default.environment.json` under `assets/`; delete that directory to seed it again.

`window.environmentEditor.edits` exposes the current file from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.environment test
$ pnpm --filter @jolly-pixel/editor.environment typecheck
$ pnpm --filter @jolly-pixel/editor.environment lint
```

## License

MIT
