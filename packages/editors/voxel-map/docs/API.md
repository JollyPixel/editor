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
frame rate. A gizmo drag disables the component, so Shift moves the dragged
object instead of flying the camera down; a Shift still held when the drag
ends stays blocked until it is released, otherwise the camera would drop the
moment the pointer comes up. The editor renders uncapped (`maxFps: Infinity`): the runtime's
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

`shared/viewFocus.ts` owns the ray itself. `castViewRay()` returns the first
solid met, then the ground plane, a square of `groundPlaneSize` centered on
the origin solved analytically rather than through a hidden mesh.
`voxelPositionOf()` turns a hit into a grid cell, either the free cell in
front of the surface or the cell the surface belongs to.

## View focus

`viewFocusPoint()` resolves the grid cell the camera is aimed at: the free
cell on top of the first surface under the screen center, pulled back along
the ray when the hit is nearer than `minDistance` or farther than
`maxDistance`, and taken `fallbackDistance` straight ahead when the ray hits
nothing at all.

`EditorScene` registers it as `EditorState.viewFocusProvider`, since the scene
owns the camera and the Lit panels do not. Panels read `EditorState.viewFocus`
on demand, which resolves to the world origin while no provider is registered.
`layer-manager` uses it so a new object spawns in view rather than at
`0,0,0`.

## Layers tree and selection

`EditorState.selection` is the single source of truth for what the layers tab
has selected, a union of three kinds: `voxel-layer`, `object-layer` and
`object`. `layer-manager` renders all of them as one `jolly-tree`, with the
objects of an object layer as its child rows, and both the viewport and the
tree write their picks into `setSelection()`. Nothing mirrors a second copy:
`activeObjectLayer` derives the object layer in play from either object kind,
and `selectedVoxelLayer` resolves only under a voxel-layer selection, which is
what keeps `VoxelBrush` from painting into an object context.

Object rows rename in place: the tree runs with `renamable`, each object node
opts in, and a committed `jolly-rename` is written back through
`updateObject()`. Layer rows do not opt in, because a layer is keyed by its
name in the world, in every object key and in every sync command; renaming one
is a primary-key change rather than an edit.

`editor-sidebar` renders the panel that matches the kind: `layer-panel` for a
voxel layer, `object-panel` for an object, and a hint for an object layer,
whose JSON carries nothing beyond the name and visibility the tree row already
edits. `object-panel` holds no Name field, since the row owns that, and no
Visible or Locked control, since the row's toggles do. `add-layer-dialog` is the single entry point for creation, defaulting to
a voxel layer, or to an object when the selection already sits in an object
layer.

## Object layer areas

`ObjectLayerRenderer` is the whole object-layer viewport. It keeps one
`AreaBox` from `@jolly-pixel/three` per visible object of a visible layer,
anchored on the object min corner: the box position is `{x, y, z}` and its
size is `{width, 1, height}`, so nothing offsets the document coordinates on
the way to the scene. `features/object-layers/objectArea.ts` owns that
mapping, along with the rounding and the one-voxel minimum applied on the way
back.

One `AreaBoxControls` is attached to the selected area, configured with
`snap: 1`, `moveAxes: "xyz"` and `resizeAxes: "xz"`. Dragging the volume moves
the object on the ground, Shift+drag moves it vertically, a face arrow resizes
from that face alone, and Alt suspends snapping while held. Selection is a
capture-phase `pointerdown` on the canvas, ahead of the listener the controls
install themselves, so one press both selects the object and starts its drag;
a press landing on a resize arrow is left to the controls.

Hook events reconcile areas by object id rather than rebuilding the layer. An
`object-updated` moves the existing box, which keeps the controls attached
while a peer or `object-panel` edits the same object, and the area under an
active gesture is left untouched until the gesture ends. A color change is
applied through `AreaBox.color`, which repaints the materials without
reallocating anything.

Areas follow the eye toggles alone: an area is drawn when neither its layer
nor the object is hidden, so every visible object layer stays on screen
whatever the tree has selected. Only a removal drops an area; hiding flips
`visible`, because rebuilding a box on every eye toggle would churn GPU
resources for a state that changes constantly while authoring. The label is
left alone while the object name is unchanged, since redrawing it re-uploads
its texture, and `AreaBoxEdges.resize()` drops a resize to the size it already
traces. Every `change` writes back through `updateObject()`, once per snapped
step; a patch that matches the stored object is dropped instead of broadcast.

Selection drives the gizmo in one direction. A viewport pick writes
`selection`, and the renderer attaches or detaches `AreaBoxControls` from the
`selectionChange` handler alone, which also decides the single object whose
nameplate is shown. Picking is gated on an object context, so the brush keeps
the pointer while a voxel layer is selected and the boxes read as reference
geometry; within an object context any drawn box is pickable, including one
belonging to another object layer.

A locked object is inert in the viewport: it is filtered out of the raycast,
so it can neither be picked nor shadow whatever sits behind it, and locking
the attached object detaches the gizmo at once. It stays selectable from its
tree row, where `object-panel` disables Position and Size but leaves the name,
color, visibility and custom properties editable.

Drag state travels through `EditorState.setGizmoDragging()`, which emits
`gizmoDraggingChange`. `EditorScene` maps it onto `FreeFlyCamera.enabled` and
`VoxelBrush` reads it to skip placing voxels, so both gizmos suspend the
camera and the brush the same way.

## Runtime modes

Normal startup fetches the asset catalog, preloads the tilesets the voxel-map document declares, then joins the voxel-map and pixel-art rooms. The rooms are the only durable store: nothing is written to browser local storage. Adding `?offline` to the URL skips all network setup and leaves the session unsaved.

## Ownership of the tileset

The voxel-map document names the tileset (`id`, `src`, `tileSize`); the pixel-art document holds its pixels. `TextureEditorBridge` seeds the drawing canvas from the loaded atlas, then every room snapshot and every stroke is pushed back into `TilesetAtlas.updateSource()`. Block definitions are not part of either document — `EditorScene` derives them from the tileset grid on awake.

## Derived block texture state

Two fields of a `BlockDefinition` have no editing control, because the paint tab already owns them. `defaultTexture.col`/`.row` and `faceTextures` follow the UV region `BlockUvBridge` keeps in sync with the block, so a block is retextured by dragging its region. `transparent` is derived by `TextureEditorBridge.syncTransparency()` from the alpha under those tiles; it runs on every stroke, room snapshot, tileset load, and block-registry change. `block-editor-dialog` therefore only configures name, shape, and tileset.

## Readiness

`EditorScene.ready` is the readiness boundary. `awake()` runs on the runtime's first frame, which is after `loadRuntime()` has already resolved, so code needing `vr` or `gridRenderer` must await `ready` rather than `loadRuntime()`.
