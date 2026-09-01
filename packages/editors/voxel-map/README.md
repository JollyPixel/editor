<h1 align="center">
  Voxel-Map Editor
</h1>

<p align="center">
  Collaborative voxel-map editing for JollyPixel
</p>

## 📌 About

This private workspace combines [`@jolly-pixel/voxel.renderer`][voxel-renderer] with the JollyPixel runtime and Lit UI. It edits voxel and object layers, block definitions, tileset textures, and map JSON.

## 🚀 Running the editor

Install dependencies from the monorepo root, then start the Vite server:

```bash
$ npm install
$ npm run dev -w @jolly-pixel/editor.voxel-map
```

The default URL connects to the asset catalog and collaborative sync server configured by Vite. On a first run the server seeds two documents: `maps/overworld.voxelmap.json`, holding a `Ground` layer and the `default` tileset, and `textures/block.pixelart`, holding the pixels of `public/textures/tileset.png`. Both live under `assets/`; delete that directory to seed it again.

Add `?offline` to skip network setup entirely. Nothing is persisted in that mode — the editor is scratch space until the page reloads.

## 📚 Architecture

- `EditorScene` owns the ECS scene, voxel renderer, and synchronization. Its `ready` promise publishes `vr` and `gridRenderer` once the scene has awoken.
- `EditorState` publishes typed UI state changes.
- `EditorSidebar` contains the Lit editing panels.
- `TextureEditorBridge`, `BlockUvBridge`, and `BlockLibraryRenderer` connect pixel editing and block previews to the voxel engine. Tile coordinates and `transparent` are derived from the paint tab, never typed in: `block-editor-dialog` configures name, shape, and tileset alone.

## 🧪 Tests and checks

```bash
$ npm run test -w @jolly-pixel/editor.voxel-map
$ npm run typecheck -w @jolly-pixel/editor.voxel-map
$ npm run lint -w @jolly-pixel/editor.voxel-map
$ npm run build -w @jolly-pixel/editor.voxel-map
```

`test-only` runs the Node.js tests without producing the HTML coverage report.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

New features and bug fixes must include tests.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
[voxel-renderer]: ../../voxel-renderer/README.md
