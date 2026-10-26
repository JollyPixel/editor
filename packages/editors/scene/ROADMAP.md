# @jolly-pixel/editor.scene ROADMAP

v1 shipped on 2026-10-25: the `scene` asset kind, engine instantiation in edit
and play mode, the `Camera`, `Light`, `Mesh`, `Script` and `VoxelMap`
component types, this editor and its studio registration. Each item below
gets its own plan before work starts.

## Inspector

- **VoxelMap layer rows.** The renderer already exposes layer visibility in
  the component data; the inspector needs the map's layer names to show a row
  per layer.

## Play from studio

Building a game from a project, the static asset catalog export, and the
game-side loaders for `voxelmap`, `blockset` and `pixelart`. Until those
loaders exist, a `VoxelMap` component renders only in the editor.

## Prefabs

Any scene can be included in another; there is no separate prefab kind. The
file already reserves `SceneActorFile.prefab`, and the room and the editor
refuse it.

- **Cut 1.** An actor with `prefab` holds no children of its own. Its name,
  visibility and transform form the instance root, and `SceneBuilder` expands
  the referenced scene's root actors under it, in edit and play mode alike.
  Instances are read-only. Cycles are refused in the editor and in
  `SceneState.accepts()`.
- **Cut 2.** Overrides addressed by `instanceActorId/innerActorId/componentId`
  paths, and "apply to prefab".

`SceneManager.appendScene()` does not fit: an appended scene adds root actors
with its own lifecycle, while an instance is parented under an actor.

## Scripts

v1 scripts name a behavior the game registers. A script asset will fill
`assets.script` next to `behavior`.

## More component types

Voxel models, GLB models, sprites and text.

## Editor extras

Play mode in the editor, a camera preview inset, copy and paste across scenes,
snapping settings and tours.
