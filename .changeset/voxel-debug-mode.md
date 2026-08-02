---
"@jolly-pixel/voxel.renderer": minor
---

Add a debug mode to `VoxelEngine`: `engine.debug` exposes live mesh statistics (faces, culled faces, triangles, vertices, chunk meshes) and a wireframe view of the meshed chunks, toggled at runtime through `debug.mode` (`"off"` / `"overlay"` / `"wireframe"`).
