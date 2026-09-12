# VoxelTransparencyRenderer

`VoxelTransparencyRenderer` composites a complete scene using weighted
blended transparency. It is exported from `@jolly-pixel/voxel.renderer`.

```ts
import * as THREE from "three/webgpu";
import { VoxelTransparencyRenderer } from "@jolly-pixel/voxel.renderer";

const renderer = new THREE.WebGPURenderer();
await renderer.init();
const transparency = new VoxelTransparencyRenderer(renderer);

// Call once per frame after updating the scene and camera.
transparency.render(scene, camera);

// On teardown, before disposing the renderer:
transparency.dispose();
```

## API

```ts
class VoxelTransparencyRenderer {
  constructor(renderer: THREE.WebGPURenderer);
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}
```

Initialize the renderer before calling `render()`. The compositor works with
`WebGPURenderer`, including its `forceWebGL: true` backend. It does not accept
the classic `WebGLRenderer`.

`render()` draws opaque and masked geometry into an offscreen target with
depth writes. It then draws transparent geometry twice against that depth:
once to accumulate weighted color and once to accumulate coverage. A final
fullscreen draw resolves the result into the caller's current render target,
or the canvas when no target is selected. Target sizes follow the destination.

The compositor temporarily changes renderer state and transparent-material
blend settings. It restores the render target, viewport, scissor, clear state,
tone mapping, output color space, MRT, render-object callback, scene background,
and material settings, including when rendering throws. Existing render-object
callbacks run during scene draws.

`dispose()` releases its render targets, shared depth texture, and resolve
material. The caller owns the scene, camera, renderer, and voxel engine.

## Color and coverage

Coverage is `1 - product(1 - alpha)` over retained, depth-visible surfaces.
Two 50% surfaces therefore produce 75% coverage. Double-sided cubes can
contribute both their near and far walls; retained internal interfaces add
further contributions. Reversing draw order does not require triangle sorting.

Color uses depth-weighted averaging and is approximate. Camera movement can
change those weights. This is not exact back-to-front alpha compositing or a
mode that applies each block's tint only once. There is no per-block nearest
surface selection or depth peeling.

All transparent scene materials participate, including non-voxel meshes.
Their original blend equations are temporarily replaced, so additive effects
need a separate render pass. Render overlays after this compositor if they
must bypass its depth and coverage rules.

`VoxelEngine` alone does not install the compositor. The voxel-map editor
installs it for its scene cameras and restores the previous rendering strategy
when leaving the scene. The block-library thumbnail renderer uses ordinary
Three.js material blending.
