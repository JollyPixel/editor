## Renderer

The `Renderer` interface defines the rendering pipeline used
by [World](world.md). It abstracts over the
underlying graphics API so the rest of the engine only depends on
a small set of operations: resize, draw, and clear.

The engine ships with one concrete implementation —
`ThreeRenderer` — built on top of Three.js's `WebGLRenderer`.

### ThreeRenderer

`ThreeRenderer` is the default renderer. It creates a
`THREE.WebGLRenderer` from a `<canvas>` element and manages
cameras, post-processing, and automatic resizing.

```ts
import { SceneEngine, ThreeRenderer } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const scene = new SceneEngine();

const renderer = new ThreeRenderer(canvas, {
  scene,
  renderMode: "direct"
});
```

```ts
interface ThreeRendererOptions {
  /** The scene whose Three.js scene graph will be rendered. */
  scene: Scene;
  /** Rendering strategy (see below). @default "direct" */
  renderMode?: "direct" | "composer";
}
```

The underlying `THREE.WebGLRenderer` is accessible via
`getSource()`:

```ts
const webGL = renderer.getSource();
webGL.toneMappingExposure = 1.5;
```

### Render modes

The renderer supports two rendering strategies, selectable at
construction time or at runtime with `setRenderMode`:

| Mode | Description |
| ---- | ----------- |
| `"direct"` | Renders the scene directly with `THREE.WebGLRenderer.render()`. Simplest and fastest for scenes without post-processing. |
| `"composer"` | Routes rendering through Three.js `EffectComposer`, enabling multi-pass post-processing effects. |

```ts
renderer.setRenderMode("composer");
```

Switching mode at runtime recreates the internal strategy,
preserves existing render components (cameras), and triggers a
resize.

### Cameras (render components)

Cameras are registered as **render components**. The renderer
iterates over all registered cameras on every draw call:

```ts
import * as THREE from "three";

const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
renderer.addRenderComponent(camera);
```

When using composer mode, each camera automatically gets its own
`RenderPass` in the effect chain. Removing a camera also removes
its associated pass:

```ts
renderer.removeRenderComponent(camera);
```

On resize, perspective cameras have their `aspect` updated and
orthographic cameras have their frustum recalculated.

### Post-processing effects

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

Effects are only applied when the render mode is `"composer"`;
calling `setEffects` in `"direct"` mode is a no-op.

### Aspect ratio

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

### Resize

`resize()` is called automatically on every draw and whenever the
window fires a resize event (wired up by
[World](world.md)). It updates the renderer size,
the effect composer (if active), and every registered camera's
projection matrix.

The renderer emits a `"resize"` event after each actual size
change:

```ts
renderer.on("resize", ({ width, height }) => {
  console.log(`Canvas resized to ${width}×${height}`);
});
```

### Draw and clear

`draw()` performs a full render frame:

1. Resizes if needed.
2. Clears the frame buffer.
3. Delegates to the active render strategy (direct or composer).
4. Emits the `"draw"` event.

```ts
renderer.onDraw(({ source }) => {
  // source is the THREE.WebGLRenderer
});
```

`clear()` clears the frame buffer without rendering.

### Events

`ThreeRenderer` extends `EventEmitter` and emits:

| Event | Payload | When it fires |
| ----- | ------- | ------------- |
| `resize` | `{ width, height }` | After the canvas size changes |
| `draw` | `{ source }` | After each render frame |

### See also

- [World](world.md) — wires the renderer into the
  game loop
- [SceneManager](scene-manager.md) — the scene graph that is rendered
