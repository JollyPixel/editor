---
"@jolly-pixel/engine": minor
---

Add per-camera post-processing: `CameraComponent.postProcessing` returns the output node of a `THREE.RenderPipeline`, which the default render strategy builds, caches, draws inside the camera viewport and disposes.
