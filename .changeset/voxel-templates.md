---
"@jolly-pixel/voxel.renderer": minor
---
Add voxel templates: `world.templates` saves groups of voxels with the world (`VoxelWorldJSON.templates`), creates them from a layer and places them into a layer, turned or mirrored, as one undoable voxel patch.
New `template-*` world commands; `VoxelWorld` emits `VoxelWorldContentCommand` and `VoxelTransform` gains `followedBy()` and `transformOffset()`.
