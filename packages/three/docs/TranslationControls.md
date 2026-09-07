# TranslationControls

`TranslationControls` moves one `THREE.Object3D` along an X, Y or Z axis. The
default helper draws one positive arrow per axis with a dark outline and an
empty center.

```ts
import { TranslationControls } from "@jolly-pixel/three";

const controls = new TranslationControls(camera, renderer.domElement, {
  space: "world",
  snap: 1
});

scene.add(controls.helper);
controls.attach(object);
controls.addEventListener("change", ({ position }) => {
  savePosition(position);
});
```

The helper keeps a constant apparent size with perspective and orthographic
cameras. It renders through scene geometry by default. Its enlarged invisible
pickers begin after the center gap, so pressing the origin does not start a
drag.

## Constructor

```ts
new TranslationControls(
  camera: THREE.Camera,
  domElement?: HTMLElement | null,
  options?: TranslationControlsOptions
)
```

A non-null `domElement` connects immediately. Pass `null` to defer input until
`connect()` is called.

```ts
interface TranslationControlsOptions {
  space?: "world" | "local";
  snap?: number | Vector3Like | null;
  appearance?: TranslationGizmoAppearanceOptions;
}
```

`space` defaults to `"world"`. `snap` defaults to `null`, which permits free
movement. A vector snap supplies a separate step for each named gizmo axis.

Snapping applies to the distance travelled from the gesture's starting point.
An object starting at `x = 0.25` with `snap: 1` therefore moves to `1.25`,
`2.25` and so on. Hold <kbd>Alt</kbd> during a pointer move to suspend snapping.

## Appearance

```ts
interface TranslationGizmoAppearanceOptions {
  size?: number;
  gap?: number;
  directions?: "positive" | "negative" | "both";
  handle?: TranslationHandleOptions;
  axes?: TranslationAxesAppearanceOptions;
  center?: false | TranslationCenterAppearanceOptions;
  outline?: false | TranslationOutlineOptions;
  picker?: TranslationPickerOptions;
  hoverColor?: THREE.ColorRepresentation;
  activeColor?: THREE.ColorRepresentation;
  depthTest?: boolean;
  renderOrder?: number;
}
```

| Option | Default | Description |
|---|---:|---|
| `size` | `0.05` | Handle size as a fraction of the camera scale. |
| `gap` | `0.15` | Empty distance between the origin and each handle. |
| `directions` | `"positive"` | Shared direction policy for all axes. |
| `handle` | `{ kind: "arrow" }` | Shared handle geometry. |
| `center` | `false` | Optional, visual-only origin sphere. |
| `outline` | dark, enabled | Back-face silhouette behind each handle. |
| `picker.radius` | `0.28` | Radius of the invisible picker. |
| `picker.lengthScale` | `1` | Picker length relative to the handle. |
| `depthTest` | `false` | Whether scene depth may hide the helper. |
| `renderOrder` | `20` | Outline render order; colored handles use the next value. |

Visible handle, outline and center materials are always transparent so the
helper is drawn in the transparent render pass. Scenes that render their own
transparent geometry would otherwise paint over an opaque helper, since
`depthTest` and `renderOrder` only apply within a single render list.

Appearance options are resolved when the controls are constructed. Recreate
the controls to change geometry or outline configuration.

### Handle shapes

```ts
type TranslationHandleOptions =
  | {
    kind: "arrow";
    shaftLength?: number;
    shaftRadius?: number;
    headLength?: number;
    headRadius?: number;
    radialSegments?: number;
  }
  | {
    kind: "sphere";
    shaftLength?: number;
    shaftRadius?: number;
    radius?: number;
    radialSegments?: number;
  };
```

Dimensions use normalized gizmo units. The complete helper receives the
camera-relative scale afterwards.

### Axes and directions

```ts
const controls = new TranslationControls(camera, canvas, {
  appearance: {
    directions: "both",
    axes: {
      x: { color: "#ff5a5a" },
      y: false,
      z: {
        directions: "positive",
        handle: { kind: "sphere" }
      }
    }
  }
});
```

An axis set to `false` has no visual or picker. Per-axis color, direction and
handle settings override their shared counterparts.

### Center marker

The center is absent by default. Enable an opaque, non-interactive marker with
its own color, radius, tessellation and outline policy:

```ts
interface TranslationCenterAppearanceOptions {
  color?: THREE.ColorRepresentation;
  radius?: number;
  radialSegments?: number;
  outline?: false | TranslationOutlineOptions;
}

center: {
  color: "#ffffff",
  radius: 0.13,
  radialSegments: 16,
  outline: {
    color: "#080b11"
  }
}
```

When `center.outline` is omitted, the marker inherits the gizmo outline. Set it
to `false` to omit only the center outline. The marker never owns picker
geometry and cannot start a free-movement gesture.

### Outline

```ts
outline: {
  color: "#ffffff",
  opacity: 0.9,
  scale: 1.15
}
```

Set `outline: false` to omit the outline geometry. `scale` must be greater than
`1`; it expands a back-face shell along the handle's vertex normals.

## Properties

### `target`

```ts
get target(): THREE.Object3D | null
```

The attached object, or `null`.

### `helper`

```ts
readonly helper: THREE.Object3D
```

Add this object to the rendered scene. It becomes visible on `attach()` and
hides on `detach()`.

### `space` and `snap`

```ts
space: "world" | "local";
snap: number | Vector3Like | null;
```

Both properties are live. A gesture latches its coordinate space when it
starts. The vector returned from `snap` is a copy.

### Gesture state

```ts
get dragging(): boolean;
get hoveredAxis(): "x" | "y" | "z" | null;
get activeAxis(): "x" | "y" | "z" | null;
```

Every configured axis stays visible while the camera rotates. A handle exactly
aligned with the view cannot begin a gesture because that view has no stable
screen-space direction for its axis.

## Methods

### `attach()` and `detach()`

```ts
attach(target: THREE.Object3D): void;
detach(): void;
```

`attach()` follows the target world position on every render. Local-space
handles also follow its world orientation. `detach()` ends an active gesture,
clears its state and hides the helper.

Dragging happens in world space before the result is converted into the
target parent's local coordinates. Translated, rotated and non-uniformly
scaled parents are supported. Reparenting during a gesture ends that gesture.

### `isOverHandle()`

```ts
isOverHandle(event: PointerEvent): boolean;
```

Use this during capture-phase scene selection so an axis handle wins over an
object behind it.

### `connect()`, `disconnect()` and `dispose()`

```ts
connect(element: HTMLElement): void;
disconnect(): void;
dispose(): void;
```

`disconnect()` removes input listeners and ends an active gesture while
leaving the target attached. `dispose()` also detaches and releases every
helper-owned geometry and material. Repeated disposal is safe.

## Events

| Event | Payload | Fired |
|---|---|---|
| `start` | axis, direction and positions | A picker claims the primary pointer. |
| `change` | axis, direction and positions | The target reaches a new effective position. |
| `end` | axis, direction, positions and `changed` | The gesture ends or is cancelled. |

`position` is in the target parent's local space. `worldPosition` is the same
point in world space. Both vectors are safe-to-keep copies.

Use `start` and `end` to suspend camera controls:

```ts
controls.addEventListener("start", () => {
  orbit.enabled = false;
});
controls.addEventListener("end", () => {
  orbit.enabled = true;
});
```
