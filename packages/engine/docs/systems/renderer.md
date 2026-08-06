# Renderer

The `Renderer` interface defines the rendering pipeline used
by [World](world.md). It abstracts over the
underlying graphics API so the rest of the engine only depends on
a small set of operations: resize, draw, clear, and dispose.

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
import { SceneManager, ThreeRenderer } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const sceneManager = new SceneManager();

const renderer = await ThreeRenderer.create(canvas, {
  sceneManager,
  renderMode: "direct"
});
```

If neither a native WebGPU backend nor the WebGL2 fallback can be
initialized (no GPU support in the browser at all), `create()`
rejects — the caller is expected to handle that failure (show an
error UI, etc.).

```ts
interface ThreeRendererOptions {
  /** Owns the scene graph that gets rendered. */
  sceneManager: SceneManager;
  /** Rendering strategy (see below). @default "direct" */
  renderMode?: "direct";
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
  sceneManager,
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
  sceneManager,
  output: {
    maxPixelRatio: 1.5,
    shadows: { type: THREE.PCFSoftShadowMap },
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1
  }
});
```

| Option | Default | Notes |
| ------ | ------- | ----- |
| `pixelRatio` | `min(devicePixelRatio, maxPixelRatio)` | An explicit value ignores the cap |
| `maxPixelRatio` | `2` | A 3× DPR display is 9× the fragments uncapped |
| `shadows` | `false` | `{}` enables it with `PCFSoftShadowMap` |
| `outputColorSpace` | `THREE.SRGBColorSpace` | |
| `toneMapping` | `THREE.NeutralToneMapping` | |
| `toneMappingExposure` | `1.25` | Lower it if bright surfaces clip to white |

`resolveRendererSettings(options, devicePixelRatio)` exposes the
same merge as a pure function, if you need to inspect the resolved
configuration without creating a context.

The underlying `THREE.WebGPURenderer` stays accessible via
`getSource()`:

```ts
const webGPU = renderer.getSource();
webGPU.toneMappingExposure = 1.5;
```

## Render modes

> [!WARNING]
> Only `"direct"` mode is implemented today. Three.js's classic
> `EffectComposer` post-processing pipeline is WebGLRenderer-only and
> does not work with `WebGPURenderer` — a composer/post-processing
> mode built on WebGPURenderer's node-based `PostProcessing` API is a
> planned follow-up. `setRenderMode("composer")` (and any value other
> than `"direct"`) throws.

| Mode | Description |
| ---- | ----------- |
| `"direct"` | Renders the scene directly with `THREE.WebGPURenderer.render()`. Honours `depth` and per-camera `viewport`. |

## Cameras (render components)

Cameras are registered as **render components** — anything
implementing `RenderComponent`, which in practice means
[`CameraComponent`](../components/camera.md). Components register
themselves in `awake()`:

```ts
world.createActor("camera")
  .addComponent(Camera3DControls, { far: 4096 });
```

Cameras render in ascending `depth` order — lower values first
(background), higher last (overlay). The sorted order is cached and
recomputed only when a camera is added, removed, or calls
`setDepth`.

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
reported a new size.

The renderer emits a `"resize"` event after each actual size
change:

```ts
renderer.on("resize", ({ width, height }) => {
  console.log(`Canvas resized to ${width}×${height}`);
});
```

## Draw and clear

`draw()` performs a full render frame:

1. Resizes if needed, and skips the frame entirely while the canvas
   is still zero-sized.
2. Refreshes the depth-sorted camera order if it changed.
3. Delegates to the active render strategy, which clears and calls
   `prepareRender` on every camera.
4. Emits the `"draw"` event.

```ts
renderer.onDraw(({ source }) => {
  // source is the THREE.WebGPURenderer
});
```

`clear()` clears the frame buffer without rendering.

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

`ThreeRenderer` extends `EventEmitter` and emits:

| Event | Payload | When it fires |
| ----- | ------- | ------------- |
| `resize` | `{ width, height }` | After the canvas size changes |
| `draw` | `{ source: THREE.WebGPURenderer }` | After each render frame |

## See also

- [Camera](../components/camera.md) — how a camera's transform is driven
- [World](world.md) — wires the renderer into the
  game loop
- [SceneManager](scene-manager.md) — the scene graph that is rendered
