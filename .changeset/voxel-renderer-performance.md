---
"@jolly-pixel/voxel.renderer": major
---

Faster meshing and leaner chunk geometry: meshes sit at their chunk origin with chunk-local positions, draw through a shared quad index, and greedy merges faces by appearance.
Edits now dirty every layer's chunks, and Rapier colliders merge cubes into cuboids, size slabs correctly and build trimeshes from shape faces.
