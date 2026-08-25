# Voxel Map Editor Boundaries

This package is a private browser application, not a published library. Its internal APIs divide into four areas:

- `EditorScene` owns the ECS scene, voxel renderer, and network synchronization.
- `EditorState` publishes typed UI-facing state events. `on()` returns a disposer that every subscriber must call when its owner is destroyed or disconnected.
- `EditorSidebar` and its Lit components edit scene data through `VoxelRenderer`. They do not own scene lifetime.
- `TextureEditorBridge`, `BlockUvBridge`, and `BlockLibraryRenderer` adapt the pixel editor and Three.js preview to voxel block definitions.

World data entering from a file or from the asset workspace goes through `parseVoxelWorld()` before it reaches `VoxelRenderer`. Block-definition batches go through `applyBlockUpdates()` so one user operation causes one chunk invalidation and one state notification.

## Brush input boundary

`VoxelBrush` consumes the frame-stable mouse transitions published by the
engine input cycle. After one brush footprint is mutated, the voxel engine is
flushed so the preview and the next brush raycast use rebuilt chunk geometry.

## Runtime modes

Normal startup fetches the asset catalog, preloads the tilesets the voxel-map document declares, then joins the voxel-map and pixel-art rooms. The rooms are the only durable store: nothing is written to browser local storage. Adding `?offline` to the URL skips all network setup and leaves the session unsaved.

## Ownership of the tileset

The voxel-map document names the tileset (`id`, `src`, `tileSize`); the pixel-art document holds its pixels. `TextureEditorBridge` seeds the drawing canvas from the loaded atlas, then every room snapshot and every stroke is pushed back into `TilesetManager.updateSourceImage()`. Block definitions are not part of either document — `EditorScene` derives them from the tileset grid on awake.

## Derived block texture state

Two fields of a `BlockDefinition` have no editing control, because the paint tab already owns them. `defaultTexture.col`/`.row` and `faceTextures` follow the UV region `BlockUvBridge` keeps in sync with the block, so a block is retextured by dragging its region. `transparent` is derived by `TextureEditorBridge.syncTransparency()` from the alpha under those tiles; it runs on every stroke, room snapshot, tileset load, and block-registry change. `block-editor-dialog` therefore only configures name, shape, and tileset.

## Readiness

`EditorScene.ready` is the readiness boundary. `awake()` runs on the runtime's first frame, which is after `loadRuntime()` has already resolved, so code needing `vr` or `gridRenderer` must await `ready` rather than `loadRuntime()`.
