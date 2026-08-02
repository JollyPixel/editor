---
"@jolly-pixel/voxel.renderer": minor
---

Speed up chunk meshing by roughly 5× on large worlds (a 1024×1024 noise world with 3M voxels drops from ~19s to ~3.5s at `chunkSize: 256`, and from ~28s to ~2.5s at the default `chunkSize: 16`).
