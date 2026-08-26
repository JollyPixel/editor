# Voxel Map Editor Boundaries

This package is a private browser application, not a published library. Its internal APIs divide into four areas:

- `EditorScene` owns the ECS scene, voxel renderer, and network synchronization.
- `EditorState` publishes typed UI-facing state events. `on()` returns a disposer that every subscriber must call when its owner is destroyed or disconnected.
- `EditorSidebar` and its Lit components edit scene data through `VoxelRenderer`. They do not own scene lifetime.
- `TextureEditorBridge`, `BlockUvBridge`, and `BlockLibraryRenderer` adapt the pixel editor and Three.js preview to voxel block definitions.

World data entering from a file or from the asset workspace goes through `parseVoxelWorld()` before it reaches `VoxelRenderer`. Block-definition batches go through `applyBlockUpdates()` so one user operation causes one chunk invalidation and one state notification.

## Camera and brush input

`FreeFlyCamera` owns WASD/arrows, Space and Shift, and the middle button for
looking around. The wheel dollies along the view; held together with the
middle button it sets the fly speed instead, between `minMoveSpeed` and
`maxMoveSpeed`. Ctrl reserves the wheel for the brush size, so the camera
ignores it. Velocity eases towards the requested speed at `responsiveness`
per second, applied against the frame delta, so the feel is the same at any
frame rate. The editor renders uncapped (`maxFps: Infinity`): the runtime's
GPU-benchmarked default is a throughput score and would throttle the camera
below the display refresh.

## Brush input boundary

`VoxelBrush` consumes the frame-stable mouse transitions published by the
engine input cycle. After one brush footprint is mutated, the voxel engine is
flushed so the preview and the next brush raycast use rebuilt chunk geometry.

The preview raycast is the most expensive per-frame work in the editor, so it
runs only when the pointer moved, the camera moved, or an edit invalidated the
hit; while the middle button steers the camera the preview is hidden and no
ray is cast at all. It intersects `VoxelRenderer.engine.root`, which holds the
chunk meshes and nothing else, rather than sweeping the whole scene graph.

## Runtime modes

Normal startup fetches the asset catalog, preloads the tilesets the voxel-map document declares, then joins the voxel-map and pixel-art rooms. The rooms are the only durable store: nothing is written to browser local storage. Adding `?offline` to the URL skips all network setup and leaves the session unsaved.

## Ownership of the tileset

The voxel-map document names the tileset (`id`, `src`, `tileSize`); the pixel-art document holds its pixels. `TextureEditorBridge` seeds the drawing canvas from the loaded atlas, then every room snapshot and every stroke is pushed back into `TilesetManager.updateSourceImage()`. Block definitions are not part of either document — `EditorScene` derives them from the tileset grid on awake.

## Derived block texture state

Two fields of a `BlockDefinition` have no editing control, because the paint tab already owns them. `defaultTexture.col`/`.row` and `faceTextures` follow the UV region `BlockUvBridge` keeps in sync with the block, so a block is retextured by dragging its region. `transparent` is derived by `TextureEditorBridge.syncTransparency()` from the alpha under those tiles; it runs on every stroke, room snapshot, tileset load, and block-registry change. `block-editor-dialog` therefore only configures name, shape, and tileset.

## Readiness

`EditorScene.ready` is the readiness boundary. `awake()` runs on the runtime's first frame, which is after `loadRuntime()` has already resolved, so code needing `vr` or `gridRenderer` must await `ready` rather than `loadRuntime()`.
