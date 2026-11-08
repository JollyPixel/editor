# Utilities

Standalone helpers exported from `@jolly-pixel/three`.

## Coordinates

### `projectToClient`

```ts
function projectToClient(
  camera: THREE.Camera,
  canvas: ClientTarget,
  point: THREE.Vector3Like
): THREE.Vector2Like | null;
```

Projects a world point to client coordinates over `canvas.getBoundingClientRect()`, y pointing down. Use it to place HTML over a 3D view or to aim synthetic pointer events.

The camera's world matrices are refreshed first, so a camera moved since the last render projects from its new pose. Returns `null` when the point is outside the camera's near and far range, including behind it.

```ts
const anchor = projectToClient(camera, renderer.domElement, object.position);
if (anchor !== null) {
  label.style.translate = `${anchor.x}px ${anchor.y}px`;
}
```

### `clientToNdc`

```ts
function clientToNdc(
  canvas: ClientTarget,
  clientX: number,
  clientY: number,
  target?: THREE.Vector2
): THREE.Vector2 | null;
```

The inverse of `projectToClient`: maps client coordinates over `canvas.getBoundingClientRect()` to normalized device coordinates, `-1` to `1` with y pointing up, ready for `Raycaster.setFromCamera`.

Points outside the canvas map past that range rather than being clamped, so a drag that leaves the canvas keeps tracking. The result is written into `target` when given, otherwise into a new `Vector2`. Returns `null` when the canvas has no area.

```ts
const pointer = new THREE.Vector2();

canvas.addEventListener("pointermove", (event) => {
  if (clientToNdc(canvas, event.clientX, event.clientY, pointer) !== null) {
    raycaster.setFromCamera(pointer, camera);
  }
});
```

### `ClientTarget`

```ts
interface ClientTarget {
  getBoundingClientRect(): Pick<
    DOMRectReadOnly,
    "left" | "top" | "width" | "height"
  >;
}
```

Any element works, a canvas included. Tests can pass a plain object returning fixed bounds.

## Canvas

### `createCanvas2D`

```ts
function createCanvas2D(
  width: number,
  height: number
): Canvas2D;

interface Canvas2D {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
}
```

Creates a canvas of the given size, in pixels, with its 2D context, for canvas-backed textures. Throws when no 2D context is available.

```ts
const { canvas, context } = createCanvas2D(64, 64);
context.fillRect(0, 0, 32, 32);

const texture = new THREE.CanvasTexture(canvas);
```

## Render targets

### `renderToTarget`

```ts
function renderToTarget(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  target: THREE.RenderTarget
): void;
```

Renders `scene` into `target` over a transparent clear, then puts back the
renderer's render target, clear color, clear alpha and `autoClear`, even when
the render throws.

### `ReadbackPixels`

```ts
class ReadbackPixels {
  static fromRenderTarget(
    renderer: THREE.WebGPURenderer,
    target: THREE.RenderTarget
  ): Promise<ReadbackPixels>;
  static fromReadback(readback: PixelReadback): ReadbackPixels;

  readonly data: Uint8ClampedArray<ArrayBuffer>;
  readonly width: number;
  readonly height: number;

  toImageData(): ImageData;
}

interface PixelReadback {
  data: THREE.TypedArray;
  width: number;
  height: number;
  bottomUp: boolean;
}
```

Turns the bytes of `readRenderTargetPixelsAsync` on an sRGB RGBA8 target into
tightly packed, top-down, straight-alpha RGBA that a 2D canvas can draw.

- Row padding is dropped. WebGPU pads each row to 256 bytes; the stride is
  derived from `data.length`.
- Set `bottomUp` on the WebGL backend, which reads the bottom row first.
- Premultiplied colors are divided by alpha in linear light, so an
  antialiased edge keeps its color instead of darkening.

`fromRenderTarget` reads the whole target and sets `bottomUp` from the
renderer's coordinate system. `fromReadback` takes bytes already read.

```ts
renderToTarget(renderer, scene, camera, target);
const pixels = await ReadbackPixels.fromRenderTarget(renderer, target);
context.putImageData(pixels.toImageData(), 0, 0);
```
