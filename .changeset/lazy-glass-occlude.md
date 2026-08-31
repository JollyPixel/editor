---
"@jolly-pixel/voxel.renderer": patch
---

Scope mesh occlusion to the layer it belongs to. A translucent layer
(`0 < opacity < 1`) is now occluded only by its own voxels: its faces survive
against opaque neighbours in other layers, and it no longer occludes them or
wins compositing over the voxels it covers.
