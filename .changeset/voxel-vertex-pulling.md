---
"@jolly-pixel/voxel.renderer": minor
"@jolly-pixel/runtime": minor
"@jolly-pixel/ui": minor
---

Chunks store 8 bytes per face, rebuilt in the vertex shader from a shared face template table (vertex pulling), with raycasts, colliders, shadows and motion vectors unchanged.
GPU memory is now measurable: the voxel `meshMemory` metric, the runtime `geometryMemory` and `textureMemory` renderer metrics, and a `bytes` metric unit (`formatBytes`) in `@jolly-pixel/ui`.
Chunks queued before leaving the view distance are no longer meshed, and dirty chunks are rescanned only when the focus or a layer's `dirtyRevision` changes.
