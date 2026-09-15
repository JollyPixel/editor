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

## 🧩 Bootstrap

`src/index.ts` only reads the browser entry point and hands it to
`VoxelMapEditor.open()`, which owns the boot sequence:

```ts
import { VoxelMapEditor } from "./boot/VoxelMapEditor.ts";

const editor = await VoxelMapEditor.open({
  canvas: "#game-container > canvas",
  offline: false
});
```

| Option | Description |
|---|---|
| `canvas` | Runtime canvas target, a selector or an `HTMLCanvasElement`. |
| `offline` | Skips identity, catalog, and network setup. Defaults to `false`. |
| `world` | `AssetId` of the voxelmap to open. Defaults to the first one in the catalog. |

`open()` creates the runtime, opens an `EditorSession`, preloads the tilesets
declared by the world document, builds the `EditorScene`, mounts the
`EditorShell`, then loads the scene. `dispose()` unwinds the shell, the session,
and the runtime.

The pieces live under `src/boot/`:

| Export | Responsibility |
|---|---|
| `assets/resolveEditorAssets` | Turns a request into the `voxelmap` and `pixelart` records. The only place aware of asset kinds. |
| `assets/preloadTilesets` | Loads the tilesets of a world record, falling back to `textures/tileset.png`. |
| `EditorSession` | Prompts for the local identity, resolves the assets, and opens the world and texture rooms. `dispose()` destroys the client. |
| `EditorShell` | Wires `jolly-log` and the editor panels to the state, the scene, and the runtime input. |

### Panels

`index.html` authors a `jolly-dock-layout` with a left dock holding one
`jolly-pane-group` (General, Blocks, Paint, Layers) and an empty right dock.
Users drag any tab into the right dock or out into a window, and the layout
remembers it under `voxel-map:layout`.

`EditorPanels` owns the single `texture-editor`. It lives in the Paint pane
unless Paint and Blocks share a group, in which case it follows whichever of
the two is the shown tab. Without it, the block library fills the Blocks pane.

### Known limitation

A voxelmap document does not reference its texture asset: `TilesetDefinition`
carries a `src` URL, not an `AssetId`. `resolveEditorAssets` therefore pairs the
requested world with the first `pixelart` record of the catalog. Opening a
specific world still cannot reach its own texture until the serialization
format of `@jolly-pixel/voxel.renderer` carries the reference.

## 🧪 Tests and checks

```bash
$ npm run test -w @jolly-pixel/editor.voxel-map
$ npm run typecheck -w @jolly-pixel/editor.voxel-map
$ npm run lint -w @jolly-pixel/editor.voxel-map
$ npm run build -w @jolly-pixel/editor.voxel-map
```

`test-only` runs the Node.js tests without producing the HTML coverage report.

## Brush toolbar

The toolbar at the bottom of the viewport sets how the brush paints. It is
disabled until a voxel layer is selected.

| Tool | Values | Shortcut |
|---|---|---|
| Mode | Build places into empty cells; Replace repaints occupied cells | `R` |
| Axis | `xz` floor, `xy` and `yz` walls, `xyz` volume | `X` cycles |
| Size | 1 to 8 | `[` / `]`, `Ctrl` + wheel |
| Pattern | Square, Circle (a ball on `xyz`) | `C` |

Right click removes in both modes. X and Z are centred on the aimed cell and
walls and volumes grow upward from it. A stroke stays on the plane it started
on and keeps the mode, axis and pattern it started with. Shortcuts are ignored
with a modifier held, while typing, and while a dialog is open.

## Block transparency

The block editor offers Opaque, Cutout, and Blended alpha modes, plus Outside
or Outside and inside face visibility. Cull faces removes covered boundaries
between voxels using the same block; disabling it keeps their directional
appearances.

Texture edits rescan affected block tiles and switch opaque/blend modes to
match their alpha. An explicitly selected Cutout mode is preserved. This
automatic scan can override an Opaque or Blended selection when its texture
does not match; use the renderer API directly when that policy must be fixed.

The scene uses weighted blended transparency through
[VoxelTransparencyRenderer](../../voxel-renderer/docs/api/core/VoxelTransparencyRenderer.md).
Overlapping colors are approximate, and each retained surface adds coverage.
Thumbnail previews use ordinary Three.js blending.

Block definitions now use `alphaMode`, `side`, and `alphaCutoff`.
Migrate saved `transparent: true` fields to `alphaMode: "blend"` before
loading older content. Layer `compositing` defaults to `"composite"`;
`"replace"` restores full-opacity cell replacement.

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

New features and bug fixes must include tests.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
[voxel-renderer]: ../../voxel-renderer/README.md
