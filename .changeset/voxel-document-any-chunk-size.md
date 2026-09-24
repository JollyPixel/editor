---
"@jolly-pixel/voxel.renderer": minor
---

`deserializeVoxelWorld` no longer rejects a document saved with another `chunkSize`: its voxels are re-partitioned into the target world's chunks.
