---
"@jolly-pixel/three": patch
"@jolly-pixel/engine": patch
"@jolly-pixel/runtime": patch
"@jolly-pixel/voxel.renderer": patch
---

Update three.js to 0.186.0.
`disposeObject3D` now ignores the base `Object3D.dispose` added in 0.186, so a plain mesh's geometry and material are freed again.
`snapValue` normalizes a negative zero result to positive zero.
