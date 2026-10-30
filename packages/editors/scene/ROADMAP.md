# @jolly-pixel/editor.scene ROADMAP

v1 shipped on 2026-10-25 with the `Camera`, `Light`, `Mesh`, `Script` and
`VoxelMap` component types.

## Anchors

Cut 1 built on 2026-10-28: a component publishes anchors and an actor hangs
from one of its parent's. The voxel map is the only provider.

- **Viewport markers** for the anchors of the selected actor, and picking them.
- **Show in voxel map** from an anchor row.
- **More providers.** Voxel-model nodes, so a sword can hang from a hand, and
  the actors of a prefab instance.

## More component types

Voxel models, GLB models, sprites and text.

## Scripts

v1 scripts name a behavior the game registers. A script asset will fill
`assets.script` next to `behavior`.

## Editor extras

Play mode in the editor, a camera preview inset, copy and paste across scenes,
snapping settings and tours.

## Play from studio

Building a game from a project, the static asset catalog export, and the
game-side loaders for `voxelmap`, `blockset` and `pixelart`. Until those
loaders exist, a `VoxelMap` component renders only in the editor.
