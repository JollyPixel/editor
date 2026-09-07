# VoxelRenderer Layers

I want to improve the voxel-map editors layers management by introducing new features:

- Cloning a voxel layer (cloning the layer with the same name but adding (1), (2) depending if layer already share the same name). Example: `layer` -> `layer (1)`
- Merging a voxel layer into another voxel layer
- Reparenting an object to another objects layer

We should make sure that voxel-renderer support all of that and that we have required hooks/events to synchronize in network those changes.

## Voxel Map integration

We want then to implement these into the voxel map editor.

- Adding a button to clone a voxel layer.
- Adding a button to merge a voxel layer into another voxel layer.
- Drag-and-drop reparenting of objects to different objects layer.
