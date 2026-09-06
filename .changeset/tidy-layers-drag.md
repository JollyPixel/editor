---
"@jolly-pixel/ui": minor
"@jolly-pixel/voxel.renderer": minor
---

`jolly-tree` takes an `acceptDrop` domain veto, consulted while dragging and on
commit. `VoxelWorld.moveLayerTo()` moves a layer to an absolute index and emits
a `layer-moved` command. The voxel-map layer tree is reordered by drag instead
of the arrow buttons, which are gone.
