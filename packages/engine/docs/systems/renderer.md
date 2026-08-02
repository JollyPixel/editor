# Renderer

The `Renderer` interface defines the rendering pipeline used
by [World](world.md). It abstracts over the
underlying graphics API so the rest of the engine only depends on
a small set of operations: resize, draw, clear, and dispose.

The engine ships with one concrete implementation —
`ThreeRenderer` — built on top of Three.js's `WebGLRenderer`.

## ThreeRenderer

`ThreeRenderer` is the default renderer. It creates a
`THREE.WebGLRenderer` from a `<canvas>` element and manages
cameras, post-processing, and automatic resizing.

```ts
import { SceneManager, ThreeRenderer } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const sceneManager = new SceneManager();

const renderer = new ThreeRenderer(canvas, {
  sceneManager,
  renderMode: "direct"
});
```

```ts
interface ThreeRendererOptions {
  /** Owns the scene graph that gets rendered. */
  sceneManager: SceneManager;
  /** Rendering strategy (see below). @default "direct" */
  renderMode?: "direct" | "composer";
  /** Passed straight to `new THREE.WebGLRenderer()`. */
  webgl?: THREE.WebGLRendererParameters;
  /** Mutable renderer state, applied after the GL context exists. */
  output?: ThreeRendererOutputOptions;
  /** Where renderer warnings go. @default a logger that prints warnings */
  logger?: Logger;
}
```

## Configuration

`webgl` covers everything that can only be decided when the GL
context is created:

```ts
new ThreeRenderer(canvas, {
  sceneManager,
  webgl: {
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

`output` covers the renderer state that can change at any time:

```ts
new ThreeRenderer(canvas, {
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

The underlying `THREE.WebGLRenderer` stays accessible via
`getSource()`:

```ts
const webGL = renderer.getSource();
webGL.toneMappingExposure = 1.5;
```

## Render modes

The renderer supports two rendering strategies, selectable at
construction time or at runtime with `setRenderMode`:

| Mode | Description |
| ---- | ----------- |
| `"direct"` | Renders the scene directly with `THREE.WebGLRenderer.render()`. Simplest and fastest for scenes without post-processing. Honours `depth` and per-camera `viewport`. |
| `"composer"` | Routes rendering through Three.js `EffectComposer`, enabling multi-pass post-processing effects. |

```ts
renderer.setRenderMode("composer");
```

Switching mode at runtime disposes the previous strategy (and its
render targets), rebuilds the passes for the registered cameras,
and resizes.

> [!WARNING]
> Composer mode ignores per-camera `viewport` rects and renders every
> camera full-canvas. Split-screen and letter-boxed cameras need
> `"direct"`. The renderer warns once when a camera with a viewport is
> registered in composer mode.

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

In composer mode each camera gets its own `RenderPass`. The passes
are ordered by `depth`, and only the first one clears the color
buffer — the rest clear depth instead, so overlay cameras composite
on top rather than wiping what came before.

`updateRenderComponent(component)` re-binds a component's pass after
it swapped its `THREE.Camera` — `CameraComponent.setProjectionMode`
calls it for you.

## Post-processing effects

In `"composer"` mode, additional passes can be added with
`setEffects`:

```ts
import { UnrealBloomPass } from
  "three/addons/postprocessing/UnrealBloomPass.js";

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5, 0.4, 0.85
);
renderer.setEffects(bloom);
```

`setEffects` replaces every previously registered effect (disposing
them) and keeps the camera passes. Calling it in `"direct"` mode logs
a warning and does nothing.

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
3. Delegates to the active render strategy (direct or composer),
   which clears and calls `prepareRender` on every camera.
4. Emits the `"draw"` event.

```ts
renderer.onDraw(({ source }) => {
  // source is the THREE.WebGLRenderer
});
```

`clear()` clears the frame buffer without rendering.

## Dispose

`dispose()` releases the GL context, its programs and its textures,
and stops the `ResizeObserver`. Browsers cap the number of live
WebGL contexts (~16 in Chrome), so an editor that opens and closes
scenes must dispose the renderers it drops — otherwise context
creation eventually starts failing and rendering stops.

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
| `draw` | `{ source }` | After each render frame |

## See also

- [Camera](../components/camera.md) — how a camera's transform is driven
- [World](world.md) — wires the renderer into the
  game loop
- [SceneManager](scene-manager.md) — the scene graph that is rendered
