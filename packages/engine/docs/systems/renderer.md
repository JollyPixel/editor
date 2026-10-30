# Renderer

`Renderer` is the drawing interface [World](world.md) depends on: resize,
draw, clear, dispose, and waiting for pipeline compiles.

## ThreeRenderer

`ThreeRenderer` draws through a `THREE.WebGPURenderer`, which uses WebGPU
when the browser supports it and WebGL2 otherwise. It is created with an
async factory, since the GPU adapter is negotiated first:

```ts
import { ThreeRenderer } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const renderer = await ThreeRenderer.create(canvas);
```

`create()` rejects when neither backend can start.

```ts
interface ThreeRendererOptions {
  /** Passed straight to `new THREE.WebGPURenderer()`. */
  webgpu?: THREE.WebGPURendererParameters;
  /** Mutable renderer state, applied after the GPU context exists. */
  output?: ThreeRendererOutputOptions;
}
```

## Configuration

`webgpu` covers everything that can only be decided when the GPU
context is created:

```ts
await ThreeRenderer.create(canvas, {
  webgpu: {
    // MSAA shades partially covered pixels at the pixel centre, which
    // extrapolates UVs past the triangle edge — turn it off for pixel-art
    // and voxel projects that sample tight atlas regions.
    antialias: false,
    alpha: false,
    logarithmicDepthBuffer: true
  }
});
```

| Option | Default | Notes |
| ------ | ------- | ----- |
| `antialias` | `true` | Cannot be changed after construction |
| `alpha` | `true` | Set `false` when the scene always paints a background |
| `powerPreference` | `"high-performance"` | Avoids the integrated GPU on hybrid laptops |
| `forceWebGL` | `false` | Skip WebGPU and use the WebGL2 backend unconditionally |

`output` covers the renderer state that can change at any time:

```ts
await ThreeRenderer.create(canvas, {
  output: {
    maxPixelRatio: 1.5,
    shadows: { type: THREE.PCFShadowMap },
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1
  }
});
```

| Option | Default | Notes |
| ------ | ------- | ----- |
| `pixelRatio` | `min(devicePixelRatio, maxPixelRatio)` | An explicit value ignores the cap |
| `maxPixelRatio` | `2` | A 3× DPR display is 9× the fragments uncapped |
| `shadows` | `false` | `{}` enables it with `PCFShadowMap` |
| `outputColorSpace` | `THREE.SRGBColorSpace` | |
| `toneMapping` | `THREE.NeutralToneMapping` | |
| `toneMappingExposure` | `1.25` | Lower it if bright surfaces clip to white |

`resolveRendererSettings(options, devicePixelRatio)` returns the merged
settings without creating a context.

`shadows.type` supports `THREE.BasicShadowMap`, `THREE.PCFShadowMap`, and
`THREE.VSMShadowMap`. `THREE.PCFSoftShadowMap` was removed from
`WebGPURenderer`; use `THREE.PCFShadowMap` for filtered shadows.

The underlying `THREE.WebGPURenderer` stays accessible via
`getSource()`:

```ts
const webGPU = renderer.getSource();
webGPU.toneMappingExposure = 1.5;
```

## Post-processing

A render component with a `postProcessing` function is drawn through a
`THREE.RenderPipeline` instead of a direct render. The function returns
the pipeline's output node and receives the objects to build it from:

```ts
interface PostProcessingContext {
  renderer: THREE.WebGPURenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
}

type PostProcessing = (context: PostProcessingContext) => THREE.Node;
```

```ts
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { mrt, normalView, output, pass, vec3, vec4 } from "three/tsl";

camera.postProcessing = ({ scene, camera }) => {
  // GTAO samples depth with textureGather, which rejects MSAA textures.
  const scenePass = pass(scene, camera, { samples: 0 });
  scenePass.setMRT(mrt({ output, normal: normalView }));

  const occlusion = ao(
    scenePass.getTextureNode("depth"),
    scenePass.getTextureNode("normal"),
    camera
  ).getTextureNode();

  return scenePass.getTextureNode("output")
    .mul(vec4(vec3(occlusion.r), 1));
};
```

The default strategy builds one pipeline per camera and keeps it across
frames. It rebuilds the pipeline when the function, the scene or the
camera's `THREE.Camera` changes (`setProjectionMode`), and disposes it
when the camera is removed, loses its post-processing, or the strategy
is disposed.

- A `pass()` inherits the canvas MSAA sample count. Pass `{ samples: 0 }`
  to any pass whose depth or normals are sampled by a later node.
- The pipeline draws inside the camera's viewport and replaces what lower
  cameras drew there.
- The pipeline renders into its own target, which is then drawn through the
  renderer's tone mapping and output color space, so later cameras and
  overlays draw over it.
- Pass targets follow the canvas size, not the viewport size.

## Cameras (render components)

A render component implements `RenderComponent`; in practice it is a
[`CameraComponent`](../components/camera.md), which registers itself in
`awake()`:

```ts
world.createActor("camera")
  .addComponent(Camera3DControls, { far: 4096 });
```

A render component exposes `threeCamera`, `depth`, a `Viewport` or `null`
as `viewport`, and `prepareRender(canvas: CanvasDimensions)`, called
before each draw. `Viewport.full` covers the whole canvas;
`viewport.pixels(canvas)` and `viewport.aspect(canvas)` convert it to
canvas pixels.

Each draw renders the cameras by ascending `depth` (background first,
registration order between equals), each inside its `viewport`. A `depth`
changed with `configure()` applies on the next draw.

## Aspect ratio

By default the renderer fills its parent element. An explicit
aspect ratio can be enforced with `setRatio`. A negative or infinite
ratio throws a `RangeError`:

```ts
// Lock to 16:9
renderer.setRatio(16 / 9);

// Reset to fill parent
renderer.setRatio(null);
```

When a ratio is set, the canvas is centered and letter-boxed
within the viewport.

## Resize

Each draw applies the size last reported by the `ResizeObserver` that
`observeResize()` installs (called by `World.connect()`). A zero size, as in
a hidden iframe, is skipped.

`"resize"` fires after each actual change, with the new `CanvasDimensions`
(`width`, `height`, `aspect`, `isEmpty`, `equals()`):

```ts
renderer.on("resize", ({ width, height }) => {
  console.log(`Canvas resized to ${width}×${height}`);
});
```

## Draw and clear

`draw(scene)` performs a full render frame:

1. Resizes if needed, and skips the frame entirely while the canvas
   is still zero-sized.
2. Refreshes the depth-sorted camera order if it changed.
3. Delegates to the active render strategy, which clears and calls
   `prepareRender` on every camera.
4. Emits the `"draw"` event.

```ts
renderer.on("draw", ({ source }) => {
  // source is the THREE.WebGPURenderer
});
```

`source.info.render` is only valid inside a `"draw"` handler: three.js resets
it on every animation-loop tick. Under `@jolly-pixel/runtime`, read the
renderer counters of `RuntimeMetrics` instead.

`clear()` clears the frame buffer without rendering.

## Pipeline compiles

`ThreeRenderer` compiles every render pipeline asynchronously, so frames keep
presenting while shaders compile. An object whose pipeline is still compiling
is drawn by a later frame. When the last pending compile settles, the
renderer emits `"compiled"`.

```ts
interface ThreeRenderer {
  /** Pipelines still compiling. */
  readonly pendingCompiles: number;
  /** Resolves once no pipeline is compiling, at once when none is. */
  compiled(): Promise<void>;
}
```

A render that runs once, into a target or a shadow map that is not redrawn
every frame, comes out incomplete while its pipelines compile. Render it, wait
for `compiled()`, then render it again:

```ts
const generator = new THREE.PMREMGenerator(renderer.getSource());
const target = generator.fromScene(room, 0.04);
scene.environment = target.texture;

await renderer.compiled();
generator.fromScene(room, 0.04, 0.1, 100, { renderTarget: target });
generator.dispose();
```

A failed compile settles like a successful one: three.js logs it and never
draws the object.

`renderComponents` lists the registered cameras in the order of the last
draw. It is read-only; register and remove cameras with `addRenderComponent()` and
`removeRenderComponent()`.

## Dispose

`dispose()` releases the GPU context and stops the `ResizeObserver`. Prefer
[`world.dispose()`](world.md#dispose), which also stops the loop and
disconnects. The renderer must not be used after disposal.

## Events

`ThreeRenderer` is an `Emitter` (`@openally/emitt`) and emits:

| Event | Payload | When it fires |
| ----- | ------- | ------------- |
| `resize` | `CanvasDimensions` | After the canvas size changes |
| `draw` | `{ source: THREE.WebGPURenderer }` | After each render frame |
| `compiled` | none | When the last pending [pipeline compile](#pipeline-compiles) settles |
| `deviceLost` | `{ api, message, reason }` | When the GPU device or WebGL context is lost |

After `deviceLost` the canvas stays blank until the page creates a new
renderer, so show a reload prompt:

```ts
renderer.on("deviceLost", ({ api, message }) => {
  showReloadPrompt(`${api} device lost: ${message}`);
});
```

## See also

- [Camera](../components/camera.md) — how a camera's transform is driven
- [World](world.md) — wires the renderer into the
  game loop
- [SceneManager](scene-manager.md) — the scene graph that is rendered
