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
