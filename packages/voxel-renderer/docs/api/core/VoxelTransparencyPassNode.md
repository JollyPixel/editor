# VoxelTransparencyPassNode

`VoxelTransparencyPassNode` renders a complete scene with weighted blended
transparency. It is a `THREE.PassNode`, so it takes the place of `pass()` as
the scene input of a `THREE.RenderPipeline`. It is exported from
`@jolly-pixel/voxel.renderer` with its `voxelTransparencyPass()` factory.

```ts
import * as THREE from "three/webgpu";
import { voxelTransparencyPass } from "@jolly-pixel/voxel.renderer";

const renderer = new THREE.WebGPURenderer();
await renderer.init();
const pipeline = new THREE.RenderPipeline(
  renderer,
  voxelTransparencyPass(scene, camera)
);

renderer.setAnimationLoop(() => pipeline.render());
```

With `@jolly-pixel/engine`, return it from a camera's `postProcessing`:

```ts
camera.postProcessing = ({ scene, camera }) => voxelTransparencyPass(scene, camera);
```

## API

```ts
interface VoxelTransparencyPassOptions {
  // MSAA sample count of the offscreen targets; 0 disables antialiasing.
  // Default: renderer.samples
  samples?: number;
}

class VoxelTransparencyPassNode extends THREE.PassNode {
  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    options?: VoxelTransparencyPassOptions
  );
}

function voxelTransparencyPass(
  scene: THREE.Scene,
  camera: THREE.Camera,
  options?: VoxelTransparencyPassOptions
): VoxelTransparencyPassNode;
```

The node works with `WebGPURenderer`, including its `forceWebGL: true`
backend. It does not accept the classic `WebGLRenderer`.

## Rendering

Each frame the node draws opaque and masked geometry into its own target with
depth writes. It then draws transparent geometry twice against that depth:
once to accumulate weighted color and once to accumulate coverage. The node's
value is the resolved color, so it can feed further nodes:

```ts
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { mrt, normalView, output, vec3, vec4 } from "three/tsl";

camera.postProcessing = ({ scene, camera }) => {
  const scenePass = voxelTransparencyPass(scene, camera, { samples: 0 });
  scenePass.setMRT(mrt({ output, normal: normalView }));

  const occlusion = ao(
    scenePass.getTextureNode("depth"),
    scenePass.getTextureNode("normal"),
    camera
  ).getTextureNode();

  return scenePass.mul(vec4(vec3(occlusion.r), 1));
};
```

The `PassNode` API applies to the opaque draw:

- `getTextureNode("output")` is the opaque layer, before transparent surfaces
  are resolved over it.
- `getTextureNode("depth")` and `getLinearDepthNode()` hold opaque depth only;
  blended surfaces do not write depth.
- `setMRT()` adds attachments, such as normals, to the opaque draw.

Pass `{ samples: 0 }` when a later node samples the depth or MRT textures.

Target sizes follow the renderer's drawing buffer. A new size is adopted only
once it has held still for a few frames; until then the previous frame size is
stretched, so a live resize does not reallocate the targets on every frame.

The node temporarily changes renderer state and transparent-material blend
settings. It restores the render target, clear state, MRT, render-object
callback, scene background, and material settings, including when rendering
throws. Existing render-object callbacks run during scene draws.

`dispose()` releases its render targets. The caller owns the scene, camera,
renderer, and voxel view.

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
need a separate render pass. Render overlays after the pipeline if they must
bypass its depth and coverage rules.

`VoxelView` alone does not install the node. The voxel-map editor sets it as
its scene camera's post-processing. The block-library thumbnail renderer uses
ordinary Three.js material blending.
