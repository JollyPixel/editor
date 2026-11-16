---
"@jolly-pixel/engine": minor
---

Add `glow` to `SceneEnvironmentFile`: it blooms emissive surfaces through `ThreeSceneGraph.postProcessing`, which cameras without their own post-processing now render through. `ThreeSceneEnvironment` now takes the `ThreeSceneGraph` instead of its `THREE.Scene`.
