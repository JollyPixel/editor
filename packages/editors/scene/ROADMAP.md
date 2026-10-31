# @jolly-pixel/editor.scene ROADMAP

v1 shipped on 2026-10-25 with the `Camera`, `Light`, `Mesh`, `Script` and
`VoxelMap` component types.

## More component types

Voxel models, GLB models, sprites and text.

## Scripts

v1 scripts name a behavior the game registers. A script asset will fill
`assets.script` next to `behavior`.

## Editor extras

Play mode in the editor, a camera preview inset, copy and paste across scenes
and tours.

## Play from studio

Building a game from a project, the static asset catalog export, and the
game-side loaders for `voxelmap`, `blockset` and `pixelart`. Until those
loaders exist, a `VoxelMap` component renders only in the editor.
