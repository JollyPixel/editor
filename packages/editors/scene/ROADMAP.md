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

Any scene can be included in another; there is no separate prefab kind.

Cut 1 shipped on 2026-10-28. An actor with `prefab` is a read-only instance
with no components or children of its own. `SceneInstance` expands the
referenced scene under it with path ids, and `PrefabScenes` leases each
referenced scene so instances follow its edits. The room refuses only an
instance of the scene itself. The picker hides scenes that would close a cycle,
judged from the catalog's dependency index, which only updates when a scene is
snapshotted. The engine skips any cycle that gets through anyway.

- **Cut 2.** Overrides addressed by `instanceActorId/innerActorId/componentId`
  paths, and "apply to prefab".
- **Hierarchy rows** for the expanded actors, read-only.
- **Release leases** of scenes no instance references any more; today they
  stay open until the editor closes.

## Scripts

v1 scripts name a behavior the game registers. A script asset will fill
`assets.script` next to `behavior`.

## More component types

Voxel models, GLB models, sprites and text.

## Editor extras

Play mode in the editor, a camera preview inset, copy and paste across scenes,
snapping settings and tours.
