---
"@jolly-pixel/voxel.renderer": major
---

Model four packed or normalized concepts as value objects: `VoxelTransform` for
rotation and flip bits, `AtlasLayout` for the atlas tile grid, `VoxelFootprint`
for an object's whole-cell area, and `ChunkGeometryKey` for a draw group. Each
owns its invariant in one place, so `ChunkGeometryKey` now rejects a tileset id
ending in `:cutout` rather than silently aliasing two draw groups, and a
rotation outside `0..3` wraps instead of spilling into the flip bits.

BREAKING: `normalizeVoxelExtent()`, `voxelObjectFootprint()` and
`VoxelObjectFootprint` are replaced by `VoxelFootprint`, `packTransform()` and
`unpackTransform()` by `VoxelTransform`, and `AtlasLayout` is a class rather
than a plain interface.
