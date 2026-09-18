---
"@jolly-pixel/engine": major
"@jolly-pixel/runtime": minor
---

Move the camera view helper into the runtime as a `viewHelper` option that follows the lowest-depth camera.
The engine drops `createViewHelper`, `OrbitFlyCamera` drops its `viewHelper` option, and `Renderer` exposes `renderComponents`.
