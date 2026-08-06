---
"@jolly-pixel/runtime": major
"@jolly-pixel/engine": major
---

Switch the rendering pipeline from `THREE.WebGLRenderer` to `THREE.WebGPURenderer` (`three/webgpu`), which renders natively on WebGPU and automatically falls back to a WebGL2 backend when WebGPU isn't available.
