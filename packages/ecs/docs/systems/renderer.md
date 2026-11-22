# Renderer

`Renderer` is the drawing interface [World](world.md) depends on: resize,
draw, clear, dispose, and waiting for pipeline compiles. Each frame, `World`
calls `draw(graph)` with its [scene graph](scene-graph.md); a renderer only
accepts the graph of its own backend.

`RenderComponent` holds what every backend needs from a camera: `depth`,
`viewport` and `prepareRender(canvas)`. A backend extends it with its own
camera type.

```ts
interface RenderComponent {
  readonly depth: number;
  readonly viewport: Viewport | null;

  prepareRender(canvas: CanvasDimensions): void;
}

type RendererEvents<T> = {
  resize: (size: CanvasDimensions) => void;
  draw: (params: { source: T; }) => void;
  compiled: () => void;
};

interface Renderer<T> {
  readonly canvas: HTMLCanvasElement;
  readonly renderComponents: readonly RenderComponent[];
  /** The backend's own renderer object. */
  readonly source: T;

  lockAspectRatio(ratio: number): this;
  unlockAspectRatio(): this;
  addRenderComponent(component: RenderComponent): void;
  removeRenderComponent(component: RenderComponent): void;
  observeResize(): void;
  unobserveResize(): void;
  resize(): void;
  draw(graph: SceneGraph): void;
  compiled(): Promise<void>;
  clear(): void;
  dispose(): void;
}
```

`Viewport.full` covers the whole canvas; `viewport.pixels(canvas)` and
`viewport.aspect(canvas)` convert a viewport to canvas pixels.

## HeadlessRenderer

`new HeadlessRenderer(canvas)` draws nothing. It keeps the registered render
components, emits `draw` with a `null` source, and its `compiled()` resolves
at once. Pair it with `HeadlessSceneGraph` to run a world without a GPU, as
in tests or a simulation.

## Canvas fit

A backend can reuse the canvas sizing from `Systems`:

- `createCanvasFit(ratio)` returns a `CanvasFit`: it fills the parent for
  `null` and letter-boxes otherwise. Its `fit(width, height)` gives the canvas
  size for a parent size, `styles` the canvas `margin` and `flex`, and
  `observeTarget(canvas)` the element to watch.
- `CanvasSize` holds a `layout` fit: `fit(width, height)` stores the fitted
  `CanvasDimensions`, and `commit()` returns them once per change, or `null`
  when they are empty or already applied.
