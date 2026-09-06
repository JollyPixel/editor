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

- `EditorScene` owns the ECS scene, voxel renderer, and synchronization. Its `ready` promise publishes `engine` and `gridRenderer` once the scene has awoken. The stores it takes are injected into every scene component it creates.
- `src/app/state/` splits UI state into four stores, each an `@openally/emitt` emitter: `SelectionStore` (what is selected, and the gizmo attached to it), `BrushStore` (block, size, style, orientation), `ShellStore` (sidebar tab, peer roster) and `WorldStore` (block-registry, layer and reset signals mirrored from the voxel world). `EditorState` composes the four and `editorState` is the shared singleton; components take the single store they read rather than the composition. Every store exposes `watch(event, listener)`, which subscribes and returns the function that unsubscribes.
- `ViewFocus` (in `src/scene/viewFocus.ts`) carries the in-view spawn point for new objects. `EditorScene` registers its provider once the camera exists; it reads as the origin before that and after teardown.
- `EditorSidebar` contains the Lit editing panels.
- `LocalBrush` owns painting. Holding the left or right button paints a stroke: the cells under the pointer are edited as it travels, once each, and every stamp travels as a single bulk command. A stroke stays at the height it started at, matching the X/Z footprint of the brush, so it never climbs onto the voxels it just laid down. It is paced rather than free-running — `stampInterval` (ms) is the shortest delay between two stamps and `stampCells` how far it may travel per stamp, so a fast pointer makes the stroke trail and catch up instead of laying a whole line down at once. Note that components receive frame deltas in seconds; the brush converts them. `editorState.brush.applyStyle()` configures how every brush preview is drawn (opacity, edge width, solid or dashed edges); it is a local preference and is never published.
- `TextureEditorBridge`, `BlockUvBridge`, and `BlockLibraryRenderer` connect pixel editing and block previews to the voxel engine. Tile coordinates and `transparent` are derived from the paint tab, never typed in: `block-editor-dialog` configures name, shape, and tileset alone.
- Brush aiming and voxel writes live in `BrushAimResolver` and `applyBrushStroke()`, leaving `LocalBrush` to coordinate input, strokes, and preview presentation.
- `ObjectLayerRenderer` owns picking and transform controls; `ObjectAreaScene` owns the Three.js projection of object-layer data.
- `PixelCollaborationSession` owns the pixel-room adapters, while `blockUvProjection.ts` contains the pure block/UV conversions.
- `LayerManager` delegates tree projection and world mutations to `layerTree.ts` and `layerActions.ts`. Layer and object panels share `custom-properties-editor`.

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
