# AGENTS.md

## three.js WebGPU gotchas (r186)

These hold for every workspace that renders with `three/webgpu`.

- Never flip `light.castShadow` at runtime: it disposes the shared
  `ShadowNode` while cached node states still use it (black frame, missing
  shadows). Toggle `renderer.shadowMap.enabled` or gate shadows per mesh.
- Never attach one `DepthTexture` to several render targets: each target
  reallocates it mid-frame. Prefer one target with MRT attachments.
- `Line2NodeMaterial` with `transparent: true` composites against the opaque
  copy, not the live framebuffer. Keep fat lines opaque and depth-tested.
- `THREE.Euler` serializes as `isEuler`/`_x`/`_y`/`_z`/`_order`. Flatten math
  objects to plain `{ x, y, z }` before they enter a network command.
- A hidden browser tab renders no frames: `requestAnimationFrame` stops, so
  matrices and render hooks go stale during browser automation.
