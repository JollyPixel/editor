---
"@jolly-pixel/three": patch
"@jolly-pixel/engine": patch
"@jolly-pixel/runtime": patch
"@jolly-pixel/physics": patch
"@jolly-pixel/voxel.renderer": patch
---

Update three.js to 0.187.0.
`BakedRoomEnvironment` now bakes a 64 pixel PMREM cube with 4 mip levels, and `createRenderTarget` returns a `CubeRenderTarget` (generated on the WebGL 2 fallback).
