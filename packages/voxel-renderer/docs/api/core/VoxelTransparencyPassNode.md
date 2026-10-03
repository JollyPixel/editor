# VoxelTransparencyPassNode

A `THREE.PassNode` that renders a scene with weighted blended (order
independent) transparency, so overlapping water, glass and leaves composite
without sorting. Use it in place of `pass()` as the scene input of a
`THREE.RenderPipeline`. `VoxelView` does not install it.

```ts
import * as THREE from "three/webgpu";
import { voxelTransparencyPass } from "@jolly-pixel/voxel.renderer";

const renderer = new THREE.WebGPURenderer();
await renderer.init();
const pipeline = new THREE.RenderPipeline(renderer, voxelTransparencyPass(scene, camera));

renderer.setAnimationLoop(() => pipeline.render());
```

With `@jolly-pixel/engine`, return it from a camera's `postProcessing`:

```ts
camera.postProcessing = ({ scene, camera }) => voxelTransparencyPass(scene, camera);
```

## API

```ts
function voxelTransparencyPass(
  scene: THREE.Scene,
  camera: THREE.Camera,
  options?: VoxelTransparencyPassOptions
): VoxelTransparencyPassNode;

class VoxelTransparencyPassNode extends THREE.PassNode {
  constructor(scene: THREE.Scene, camera: THREE.Camera, options?: VoxelTransparencyPassOptions);
}
```

| Option | Default | Description |
| --- | --- | --- |
| `samples` | `renderer.samples` | MSAA samples of the offscreen targets; `0` disables antialiasing. |

Works with `WebGPURenderer`, including `forceWebGL: true`, not with the classic
`WebGLRenderer`. `dispose()` releases the render targets; the caller owns the
scene, camera and renderer.

## Chaining nodes

The node's value is the final colour, so further nodes can use it. The
`PassNode` texture API covers the opaque draw only:

- `getTextureNode("output")` is the opaque image, before transparent surfaces.
- `getTextureNode("depth")` and `getLinearDepthNode()` hold opaque depth;
  transparent surfaces write no depth.
- `setMRT()` adds attachments, such as normals, to the opaque draw.

Pass `{ samples: 0 }` when a later node samples the depth or MRT textures.

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

## Limitations

- Colour is a depth-weighted average, not exact back-to-front compositing, and
  can shift as the camera moves.
- Double-sided transparent blocks contribute both their near and far walls.
- Every transparent material in the scene goes through the pass, voxel or not.
  Their blend settings are replaced during the frame and restored afterwards,
  so additive effects need a separate render pass.
