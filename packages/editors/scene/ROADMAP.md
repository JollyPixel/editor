# @jolly-pixel/editor.scene ROADMAP

## More component types

GLB models and sprites.

Note:
- `VoxelModel` does not play the model's animation sets yet.

## Scripts

v1 scripts name a behavior the game registers. A script asset will fill
`assets.script` next to `behavior`.

## Play from studio

Building a game from a project, the static asset catalog export, and the
game-side loaders for `voxelmap`, `voxelmodel`, `blockset` and `pixelart`.
Until those loaders exist, `VoxelMap` and `VoxelModel` components render only
in the editor.
