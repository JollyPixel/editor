# Renderer

The `Renderer` interface defines the rendering pipeline used
by [World](world.md). It abstracts over the
underlying graphics API so the rest of the engine only depends on
a small set of operations: resize, draw, clear, dispose, and waiting
for pending GPU pipeline compiles.

The engine ships with one concrete implementation —
`ThreeRenderer` — built on top of Three.js's `WebGPURenderer`.
`WebGPURenderer` renders through a native WebGPU backend when the
browser supports it, and automatically falls back to a WebGL2
backend otherwise — so there is a single renderer implementation
covering both cases.

## ThreeRenderer

`ThreeRenderer` is the default renderer. It creates a
`THREE.WebGPURenderer` from a `<canvas>` element and manages
cameras and automatic resizing.

`WebGPURenderer` requires an asynchronous `init()` call before it can
be used (it negotiates a GPU adapter), so `ThreeRenderer` is built
with a static async factory rather than its constructor:

```ts
import { ThreeRenderer } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const renderer = await ThreeRenderer.create(canvas);
```

If neither a native WebGPU backend nor the WebGL2 fallback can be
initialized (no GPU support in the browser at all), `create()`
rejects — the caller is expected to handle that failure (show an
error UI, etc.).

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

`resolveRendererSettings(options, devicePixelRatio)` exposes the
same merge as a pure function, if you need to inspect the resolved
configuration without creating a context.

`shadows.type` supports `THREE.BasicShadowMap`, `THREE.PCFShadowMap`, and
`THREE.VSMShadowMap`. `THREE.PCFSoftShadowMap` was removed from
`WebGPURenderer`; use `THREE.PCFShadowMap` for filtered shadows.

The underlying `THREE.WebGPURenderer` stays accessible via
`getSource()`:

```ts
const webGPU = renderer.getSource();
webGPU.toneMappingExposure = 1.5;
```

## Drawing the cameras

Each draw sorts the registered cameras by ascending `depth`, keeping
registration order between equal depths, and calls
`THREE.WebGPURenderer.render()` once per camera inside its `viewport`. A
`depth` changed between two draws applies on the next one.

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

Cameras are registered as **render components** — anything
implementing `RenderComponent`, which in practice means
[`CameraComponent`](../components/camera.md). Components register
themselves in `awake()`:

```ts
world.createActor("camera")
  .addComponent(Camera3DControls, { far: 4096 });
```

Cameras render in ascending `depth` order: lower values first
(background), higher last (overlay). The cameras are sorted on every
draw, so a `depth` changed with `configure()` applies on the next frame.

## Aspect ratio

By default the renderer fills its parent element. An explicit
aspect ratio can be enforced with `setRatio`:

```ts
// Lock to 16:9
renderer.setRatio(16 / 9);

// Reset to fill parent
renderer.setRatio(null);
```

When a ratio is set, the canvas is centered and letter-boxed
within the viewport.

## Resize

`resize()` is called automatically on every draw, and the pending
size is fed by a `ResizeObserver` installed by `observeResize()`
(wired up by [World](world.md)). It is a no-op unless the observer
reported a size other than the one last applied. A zero size, as
in a hidden iframe, is skipped: showing the canvas again at its
previous size does not reallocate the frame buffers.

The renderer emits a `"resize"` event after each actual size
change:

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

`source.info.render` is only valid inside a `"draw"` handler. Three.js resets
it at the start of every animation-loop tick, including ticks a frame cap
skips. Under `@jolly-pixel/runtime`, read the latched
[renderer counters](../../../runtime/docs/api/RuntimeMetrics.md#renderer-counters)
instead.

`clear()` clears the frame buffer without rendering.

## Pipeline compiles

`ThreeRenderer` compiles every render pipeline asynchronously, including the
ones three.js creates inside a render: scene materials, post-processing
passes, the output pass and `PMREMGenerator`. The browser compiles them in
parallel, off the GPU process main thread, so frames keep presenting while
shaders compile.

An object whose pipeline is still compiling is skipped by the frame and drawn
by a later one. When the last pending compile settles, the renderer emits
`"compiled"`; under `@jolly-pixel/runtime` this requests a frame.

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

`dispose()` releases the GPU context, its programs and its textures,
and stops the `ResizeObserver`. Browsers cap the number of live
GPU contexts, so an editor that opens and closes scenes must dispose
the renderers it drops — otherwise context creation eventually
starts failing and rendering stops.

```ts
world.dispose(); // stops the loop, disconnects, disposes the renderer
```

Prefer [`World.dispose()`](world.md), which sequences the teardown
correctly. The renderer must not be used after disposal.

## Events

`ThreeRenderer` extends `Emitter` (from [`@openally/emitt`](https://github.com/OpenAlly/npm-packages/tree/main/src/emitt)) and emits:

| Event | Payload | When it fires |
| ----- | ------- | ------------- |
| `resize` | `{ width, height }` | After the canvas size changes |
| `draw` | `{ source: THREE.WebGPURenderer }` | After each render frame |
| `compiled` | none | When the last pending [pipeline compile](#pipeline-compiles) settles |
| `deviceLost` | `{ api, message, reason }` | When the GPU device or WebGL context is lost |

After `deviceLost`, three.js has already logged the loss and stops rendering.
The canvas stays blank until the page creates a new renderer, so show a reload
prompt:

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
