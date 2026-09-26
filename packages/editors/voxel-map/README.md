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

The Vite plugin injects the first `voxelmap` of the catalog as the launch target. Add `?target=<assetId>` to open another map and `?max-fps=<n>` to cap the frame rate. Add `?offline` to run the asset back-end inside the page instead of connecting to the server: the editor opens a seeded map as a guest and no socket is opened. The workspace is stored in the browser (IndexedDB), so maps, tilesets and their ids survive a reload, and the last opened map is reopened. A second tab connects to the tab that owns the persistent workspace through BroadcastChannel.

If the asset catalog does not respond, the editor offers Retry or Open offline
workspace. Build for a static host with
`pnpm --filter @jolly-pixel/editor.voxel-map build:static`; that build starts
offline without contacting an asset server.

The Map Config folder of the General tab exports the map with its tilesets as one `.zip` and imports such an archive, offline or on a server. When the archive holds assets the workspace already has, a dialog offers to replace them, keep them, or import the archive as a copy, once for the whole archive, and names the assets outside the archive that a replace would affect. The editor then reloads onto the imported map. Offline, **Reset workspace** deletes what the browser stored and seeds a new map.

Its View section sets how this browser draws the map; nothing there is saved in the map. **Lighting** picks Flat, Studio (the default) or Daylight, which adds a sky and a warm sun. **Reflections** lights material groups with a studio environment, which metal needs to show. **Occlusion** darkens corners and rebuilds every chunk. **Shadows** casts sun shadows around the camera. All three are off by default.

The block editor's Material section names a block's material group. **Finish** saves roughness, metalness and glow for the whole group in the map. Block thumbnails show the finish.

## 🧩 Bootstrap

`src/index.ts` hands the editor class to `bootStandalone()` from
[`@jolly-pixel/editor.host`](../host/README.md), which reads the launch,
prompts for the identity, opens the `EditorSession` and calls `mount`:

```ts
import { bootStandalone } from "@jolly-pixel/editor.host";
import { VoxelMapEditor } from "./boot/VoxelMapEditor.ts";

void bootStandalone(VoxelMapEditor, {
  dev: import.meta.env.DEV,
  debugHandle: "voxelMapEditor",
  forceOffline: import.meta.env.MODE === "static",
  offline: async() => {
    const { loadWorldProject } = await import("./boot/worldProject.ts");

    return loadWorldProject();
  }
});
```

Its static members accept `voxelmap` targets and declare the pixel-art model
kind, so the session leases every tileset of the map in parallel before the
editor mounts. Offline, the host opens an IndexedDB-backed workspace, seeds it
with the project of `loadWorldProject()` when it is empty, and mounts the same
editor on it.

`VoxelMapEditor.mount()` creates the `EditorState`, boots the runtime through
`EditorRuntime`, builds the `EditorScene` on the target room and mounts the
`EditorShell`. Once the scene resolves its `VoxelMapWorkspace`, the shell
attaches it to the panels and the brush toolbar. `dispose()` unwinds the shell, the
session and the runtime; the scene releases everything it built.

`EditorScene` owns the map: a `MapDocument` relays the engine commands as
`layerUpdated`, `blockRegistryChanged`, `tilesetsChanged` and `reset`, over a
`WorldSource` that loads worlds through the room (`RoomWorldSource`).
`MapCollaboration` groups the roster, the peer selections, the peer brushes
and the peer frustums.

The pieces live under `src/boot/`:

| Export | Responsibility |
|---|---|
| `EditorShell` | Wires `jolly-log` to the state, then attaches the workspace to the panels and the brush toolbar. |
| `createWorldProject` | Builds the asset handlers and the seed (default tileset and map), shared by the Vite seed and the offline workspace. |
| `loadWorldProject` | Fetches `textures/tileset.png` and builds the offline project under a random tileset id. |

`map-config-panel` renders `<jolly-archive-actions>` over
`session.archives()` from `@jolly-pixel/editor.host`, which exports, imports
and resets the map workspace.

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
whenever the `MapDocument` reports `tilesetsChanged` (a tileset command or a
world reset) or the catalog changes. `TilesetActions` edits it through the engine, which publishes the
change to the world room.

A tileset is a `pixelart` asset. Its definition links it through
`asset.id`; `src` is not used to resolve it, so a definition with only a `src`
loads unlinked. A definition that resolves to no asset is unlinked: its name is
read-only, and when it has no source image to open it keeps a disabled texture
tab that cannot be painted but can still be edited and removed. The definition `id` is an internal key that
blocks reference, and the label shown everywhere is the asset's file name.

Tilesets are managed from the texture editor's tab strip, which stays visible
with a single tileset. Each tab shows its block count as a badge, with the tile
size in its tooltip. `+` after the tabs creates a blank pixel-art asset (the
server suffixes a taken path) or links an existing one; the tile size chosen
there becomes the map's default for the next tileset. The edit button of the
active tab opens a dialog for that tileset alone: it renames it (a catalog
rename), changes its tile size and removes it. A session without
`TilesetActions` hides `+` and opens the dialog read-only. Removing a tileset keeps its asset and leaves its blocks
without texture; the Block Library outlines those blocks in red and lists them
above the grid.

`TilesetAtlases` feeds the engine atlases from the tilesets' pixel documents,
with no panel involved: each tileset gets a `TilesetAtlasBridge` over the
`PixelDocument` leased from the session (a local document for an
unlinked tileset with a source image). The texture editor shows one tab per
tileset; each tab that can be opened leases the same document and attaches a canvas and the
presence layers to it. When a peer deletes the asset of an open tab, the tab
keeps its lease and is labelled `(detached)` until the tileset is removed. Selecting a block activates its tileset's tab. The block editor assigns
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
`/?target=<assetId>&max-fps=<n>`. In dev builds the opened editor is exposed as
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
disabled while no voxel layer is selected, and a notice above it says why:
with an object layer or object selected it offers to select the last voxel
layer again; in a map without voxel layers it asks for one, and a paint click
logs a warning in `jolly-log`.

A layer is always selected while the map has one. Clicking outside the layer
rows keeps the selection. When the selected layer is removed, locally or by a
peer, the selection moves to the next layer of the same kind (the previous one
if it was the last), a removed object hands it to its object layer, and a
renamed layer keeps it. `SelectionStore.reconcile()` applies these rules on
every `layerUpdated` and `reset`.

The eye toggle of a layer, object layer or object is local: peers never see it
and it lasts until the page reloads. `LayerVisibilityStore` holds the
overrides over the saved `visible` values.

| Tool | Values | Shortcut |
|---|---|---|
| Mode | Build places into empty cells; Replace repaints occupied cells | `R` |
| Axis | `xz` floor, `xy` and `yz` walls, `xyz` volume | `X` cycles |
| Size | 1 to 16 | `[` / `]`, `Ctrl` + wheel |
| Pattern | Square, Circle (a ball on `xyz`) | `C` |

Right click removes in both modes. X and Z are centred on the aimed cell. The
height of walls and volumes follows the aimed face: on a top face removing digs
down from the aimed cell and building rises from the cell above it, a bottom
face mirrors that, and a side face centres the height too. A stroke stays on
the plane it started on, keeps the mode, axis, pattern and height anchor it
started with, and moves by as many cells as the pointer crossed on that plane,
whatever it has already placed or removed. Shortcuts are ignored with a
modifier held, while typing, and while a dialog is open.

The preview shows what a right click removes and highlights the hovered cube
face of the aimed cell, whatever the brush size or pattern; a build lands on
the other side of that face. Peers see it too.

## Block transparency

The block editor offers Opaque, Cutout, and Blended alpha modes, plus Outside
or Outside and inside face visibility. Cull faces removes the faces a
neighbouring block covers: boundaries between voxels using the same block, and
faces against an opaque neighbour. It is off by default for Cutout and Blended
blocks, which keeps the inside of a block complete when seen through its holes.

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
