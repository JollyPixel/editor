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
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.voxel-map dev
```

The default URL connects to the asset catalog and collaborative sync server configured by Vite. On a first run the server seeds two documents: `maps/overworld.voxelmap.json`, holding a `Ground` layer and the `default` tileset, and `textures/block.pixelart`, holding the pixels of `public/textures/tileset.png` under the fixed asset id `tileset-default`. Both live under `assets/`; delete that directory to seed it again. A workspace seeded before tilesets referenced asset ids shows its `default` tileset as unlinked.

Add `?world=<assetId>` to open a given map and `?max-fps=<n>` to cap the frame rate. Add `?offline` to skip network setup entirely. Nothing is persisted in that mode — the editor is scratch space until the page reloads.

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
| `maxFps` | Frame rate cap. Defaults to `Infinity`. |

`open()` creates the runtime, opens an `EditorSession` and waits for its
catalog, builds the `EditorScene`, mounts the `EditorShell`, then loads the
scene. Offline, it preloads `textures/tileset.png` as the only tileset. `dispose()` unwinds the shell, the session,
and the runtime.

The pieces live under `src/boot/`:

| Export | Responsibility |
|---|---|
| `assets/resolveEditorAssets` | Turns a request into the `voxelmap` record. |
| `assets/preloadOfflineTilesets` | Loads `textures/tileset.png` for the offline session. |
| `EditorSession` | Prompts for the local identity, resolves the world, joins the catalog through `@jolly-pixel/asset-server/catalog/client`, and opens the world room. `textureRoom(assetId)` opens a pixel-art room. `dispose()` destroys the client. |
| `EditorShell` | Wires `jolly-log` and the editor panels to the state, the scene, and the runtime input. |

### Panels

`index.html` authors a `jolly-dock-layout` with a left dock holding one
`jolly-pane-group` (General, Blocks, Paint, Layers) and an empty right dock.
Users drag any tab into the right dock or out into a window, and the layout
remembers it under `voxel-map:layout`.

`EditorPanels` owns the single `texture-editor`. It lives in the Paint pane
unless Paint and Blocks share a group, in which case it follows whichever of
the two is the shown tab. Without it, the block library fills the Blocks pane.

## Tilesets

The map's tileset list is `engine.tilesets` from `@jolly-pixel/voxel.renderer`;
`TilesetDirectory` mirrors it, with catalog labels, into the `TilesetStore`
whenever the engine applies a tileset event, a snapshot arrives or the catalog
changes. `TilesetActions` edits it through the engine, which publishes the
change to the world room.

A tileset is a `pixelart` asset. Its definition's `src` holds the asset id;
an older `src` matching a pixel-art record's source path also resolves. A
definition that resolves to no asset is unlinked: it is listed but has no
texture tab and cannot be edited. The definition `id` is an internal key that
blocks reference, and the label shown everywhere is the asset's file name.

The Tilesets folder of the Blocks pane lists each tileset with its tile size
and block count; clicking one opens its texture tab. `+` creates a blank
pixel-art asset (the server suffixes a taken path) or links an existing one. The manage dialog sets the map's
default tile size, renames a tileset (a catalog rename), changes its tile size
and removes it. Removing a tileset keeps its asset and leaves its blocks
without texture; the Block Library outlines those blocks in red and lists them
above the grid.

The texture editor shows one tab per linked tileset and keeps every tab's room
joined. Selecting a block activates its tileset's tab. The block editor assigns
a block to one tileset, keeping its texel position, and sets its UV size, the
texel side of its region (`TileRef.size`).

The Block Library grid height can be dragged from its bottom edge; the height
is stored under `voxel-map:block-library:height`.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.voxel-map test
$ pnpm --filter @jolly-pixel/editor.voxel-map typecheck
$ pnpm --filter @jolly-pixel/editor.voxel-map lint
$ pnpm --filter @jolly-pixel/editor.voxel-map build
```

`test-only` runs the Node.js tests without producing the HTML coverage report.

`test:e2e` runs the Playwright suite in `test/e2e`. It starts `pnpm run dev:e2e`,
a Vite server on port 3002 whose asset workspace lives in memory. Each test
creates its own tileset and world through the catalog, then opens
`/?world=<assetId>&max-fps=<n>`. In dev builds the opened editor is exposed as
`window.voxelMapEditor`.

```bash
$ pnpm exec playwright install chromium
$ pnpm --filter @jolly-pixel/editor.voxel-map test:e2e
```

Node.js tests cover pure logic (brush footprints, UV projection, grid layout,
layer drop rules). Behavior that depends on the scene, the DOM or the network
belongs to the E2E suite.

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
