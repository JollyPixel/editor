# AreaBoxControls

`AreaBoxControls` moves and resizes one [`AreaBox`](./AreaBox.md) with the pointer. As a `THREE.Controls` subclass, it shares the `OrbitControls` lifecycle and `enabled` contract.

```ts
import { AreaBox, AreaBoxControls } from "@jolly-pixel/three";

const controls = new AreaBoxControls(camera, renderer.domElement, {
  snap: 1,
  moveAxes: "xz",
  resizeAxes: "xz"
});

controls.attach(area);
controls.addEventListener("change", ({ min, size }) => {
  persist(min, size);
});
```

## Gestures

| Gesture | Effect |
|---|---|
| Drag the volume | Moves the area on the ground plane. |
| <kbd>Shift</kbd> + drag the volume | Moves the area vertically (requires `moveAxes: "xyz"`). |
| Drag a face arrow | Moves that face alone; the opposite face stays fixed. |
| <kbd>Alt</kbd> during a gesture | Suspends snapping while held. |

Shift remains live until the first movement, then the drag plane locks to prevent jumps.

Each of the six constant-screen-size arrows has a thin shaft, cone head and enlarged invisible picker. Pickers may cover small areas, and arrows win hit tests over the volume. Reduce `handleSize` for areas one or two cells wide.

## Constructor

```ts
new AreaBoxControls(
  camera: THREE.Camera,
  domElement?: HTMLElement | null,
  options?: AreaBoxControlsOptions
)
```

A non-null `domElement` connects immediately, while `null` defers connection until `connect()`.

```ts
interface AreaBoxControlsOptions {
  snap?: number | Vector3Like | null;
  minSize?: Vector3Like | null;
  bounds?: THREE.Box3 | null;
  moveAxes?: AreaAxisPolicy;
  resizeAxes?: AreaAxisPolicy;
  handleSize?: number;
}
```

| Option | Default | Description |
|---|---:|---|
| `snap` | `1` | Grid step. `null` disables snapping. |
| `minSize` | one snap step per axis | Smallest extent a resize may reach, per axis. |
| `bounds` | `null` | Parent-space volume used to clamp moves and dragged faces. |
| `moveAxes` | `"xz"` | Axes a move may affect. |
| `resizeAxes` | `"xz"` | Axes a resize may affect; arrows of excluded axes are hidden. |
| `handleSize` | `0.035` | Arrow size as a fraction of the viewport height. |

All options except `handleSize` are live properties. Changing `resizeAxes` updates the arrows immediately.

Moving an area larger than the bounds preserves its size and pins its min corner to the lower bound. During resize, `minSize` wins when both constraints conflict.

### Snapping

Snapping is **absolute**. Values discard any sub-step offset and land on step multiples, so `x = 0.3` snaps on first touch.

Moves snap the min corner. Resizes snap the dragged face and preserve the opposite face. Crossing it clamps at `minSize` without inverting the box.

### Axis policies

```ts
type AreaAxisPolicy = "xz" | "xyz";
```

`"xz"` keeps gestures on the ground plane, while `"xyz"` enables the vertical axis. The policies are independent. Tile editors with fixed height can keep both at `"xz"`. Level editors placing trigger volumes can set both to `"xyz"`.

## Properties

### `area`

```ts
get area(): AreaBox | null
```

The attached area, or `null`.

### `dragging`

```ts
get dragging(): boolean
```

`true` between `start` and `end`. Use it to skip host selection after the controls claim a drag.

### `camera`

```ts
get camera(): THREE.Camera
```

Alias of the inherited `object`.

## Methods

### `attach()` / `detach()`

```ts
attach(area: AreaBox, options?: { from?: PointerEvent }): boolean
detach(): void
```

`attach()` parents the arrows into `area` and sets it to `"active"`. `detach()` reverses both.

Controls raycast only the attached area. Pass the selecting `pointerdown` as `from` to claim the gesture before camera controls receive it. The return value reports whether it was claimed.

```ts
// Capture phase: the host decides what is selected before the area controls
// and the camera controls see the press.
canvas.addEventListener("pointerdown", (event) => {
  if (controls.isOverHandle(event)) {
    // The press belongs to the gizmo, not to whatever lies behind it.
    return;
  }

  const area = pick(event);
  if (area === null) {
    controls.detach();
  }
  else {
    controls.attach(area, { from: event });
  }
}, true);
```

The host chooses the area using its own layers, visibility and identity rules. Calling `detach()` during a gesture ends it and emits `end`.

### `isOverHandle()`

```ts
isOverHandle(event: PointerEvent): boolean
```

Checks whether `event` hits an attached resize arrow. Call it before host picking because arrows lie outside the area and raycast through other geometry. Otherwise the host may select an object behind the arrow and interrupt the resize.

### `connect()` / `disconnect()` / `dispose()`

```ts
connect(element: HTMLElement): void
disconnect(): void
dispose(): void
```

`disconnect()` ends the gesture and removes listeners. `dispose()` also detaches and releases the arrow geometry, which is created once and reparented on `attach()`.

## Events

| Event | Payload | Fired |
|---|---|---|
| `start` | `{ mode, axis }` | A gesture began. |
| `change` | `{ mode, axis, min, size }` | The area moved or resized. |
| `end` | `{ mode, axis, min, size }` | The gesture ended. |

`mode` is `"move"` or `"resize"`. `axis` is the resized axis or `null` for a move. `min` and `size` are safe-to-keep copies.

`change` is deduplicated, so snapped drags emit at most once per grid step. Persist `change` for live updates. The `end` event confirms the final value, while free drags (`snap: null` or <kbd>Alt</kbd>) normally emit on every pointer event.

### Suspending the camera

Area controls do not modify other controls. Suspend them with `start` and `end`:

```ts
controls.addEventListener("start", () => {
  orbit.enabled = false;
});
controls.addEventListener("end", () => {
  orbit.enabled = true;
});
```

## Applying changes

The controls mutate the area during a drag. Owners may overwrite `position` and `size` mid-drag, including after a remote conflict. The next pointer event uses the corrected state in **parent** space, avoiding transformed-parent offsets.
