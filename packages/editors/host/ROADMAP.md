# @jolly-pixel/editor.host — ROADMAP

## Host shell

A shell (tabs/windows that list assets and open editors) that resolves a
target's kind to an editor module and calls its `mount` itself. Once it exists:

- Revisit the `EditorDefinition` contract, including how embedded panels
  (voxel-map's Paint tab, voxel-model's texture panel) fit, since today they
  take a lease rather than a context.
- Settle the `hostMessage` handshake: an origin allow-list, and whether the
  editor posts a "ready" message before the host sends the launch.
- Opaque launch tokens: a `/edit/<token>` route that resolves to a target, so
  the id stays out of the URL.

## Offline workspaces

- Import as copy: an optional `rebind(state, idMap)` on `AssetKindHandler`, and
  a third option in the collision dialog.
- Offer offline mode when the socket or catalog is unreachable, and a build
  flag for static hosting.
- A shared-tab workspace over `BroadcastChannel` instead of the tab lock.

Will be done in the future (but ignore them for now)

- Host shell: a per-asset "Export" action and in-place navigation after an
  import.
- Whole-workspace export and import in the UI. If it outgrows the room cap, an
  HTTP streaming endpoint for that case only, with an Origin check.
- voxel-model and pixel-art have no archive UI yet. The `session.archive` port
  already serves them.

## Editors

▎ voxel-renderer model/view split, so a voxel-map (and voxel-model) target can be leased as a synced model instead of room-only, with the editor keeping only the view.

Three things stacked:

1. VoxelEngine is one class doing two jobs. packages/voxel-renderer/src/VoxelEngine.ts:62 holds the model (world, blockRegistry, shapeRegistry, tilesetManager, history, plus applyVoxelCommand/applyTilesetCommand) and the view (root: THREE.Group, VoxelMeshBuilder, ChunkMaterialCache, ChunkMeshStore, ChunkRebuildQueue, ChunkVisibility, collider) in the same object. Splitting means a headless model — voxel data + command application + history, no Three.js — and a view that subscribes to it and maintains meshes.

2. "leased as a synced model instead of room-only" is about AssetLeases in the host (packages/editors/host/src/session/AssetLeases.ts). It hands out two shapes:
- openRoom(kind, id) → AssetRoomLease: just { record, room, release }. The caller gets a raw network room and wires its own state.
- open(kindHandler, id) → AssetLease: adds model + ready, built by an AssetModelKind.createModel(room) (AssetLease.ts:11). The model is created once and shared by every holder, refcounted.

Today the target asset always takes the room-only path — EditorSession.ts:164 calls this.assets.openRoom(options.accepts, …). Only dependencies get synced models: EditorSession.#syncDependencies calls assets.open(kind, assetId), which is how voxel-model gets a live PixelDocument for its texture (MODEL_TEXTURE_KIND, boot/modelTexture.ts:37).

3. What changes. Once voxel-renderer has a model/view split, you can register a AssetModelKind for the voxel-map and voxel-model kinds. The target then leases as { model, ready, room }, the sync layer lives in the package (with the room as transport) instead of being re-wired in each editor's boot code, and VoxelMapEditor/VoxelModelEditor keep only the view + tools. Side benefit: a voxel-model opened as a dependency of a voxel-map would get the same synced model for free, same as textures do now.
