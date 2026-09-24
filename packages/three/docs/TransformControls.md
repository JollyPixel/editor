# TransformControls

`TransformControls` translates, rotates and scales one `THREE.Object3D` from a
camera-scaled gizmo. The gizmo axes can follow the world, the target, its
parent, the view or any quaternion, and rotation and scaling can happen around
a pivot that is not the target's origin.

```ts
import { TransformControls } from "@jolly-pixel/three";

const controls = new TransformControls(camera, renderer.domElement, {
  mode: "rotate",
  orientation: "local",
  snap: {
    rotate: Math.PI / 12
  }
});

scene.add(controls.helper);
controls.attach(object);
controls.addEventListener("change", ({ quaternion }) => {
  saveRotation(quaternion);
});
```

The helper keeps a constant apparent size with perspective and orthographic
cameras and renders through scene geometry by default.

## Constructor

```ts
new TransformControls(
  camera: THREE.Camera,
  domElement?: HTMLElement | null,
  options?: TransformControlsOptions
)
```

A non-null `domElement` connects immediately. Pass `null` to defer input until
`connect()` is called.

```ts
interface TransformControlsOptions {
  mode?: "translate" | "rotate" | "scale";
  orientation?: TransformOrientation;
  pivot?: TransformPivot;
  snap?: TransformSnapOptions;
  axes?: { x?: boolean; y?: boolean; z?: boolean; };
  limits?: THREE.Box3 | null;
  appearance?: TransformGizmoAppearanceOptions;
}
```

Every option except `appearance` is also a live property.

## Modes and handles

| Mode | Handles |
|---|---|
| `translate` | One arrow per axis, one plane handle per axis pair, optional center that moves on the view plane. |
| `rotate` | One ring per axis, plus a screen-facing view ring. |
| `scale` | One cube-tipped handle per axis, one plane handle per axis pair, optional center that scales uniformly. |

The element's cursor becomes `grab` over a handle and `grabbing` during a gesture, then returns to its previous value.

Events and `hoveredHandle` identify a handle with a small union:

```ts
type TransformHandle =
  | { kind: "axis"; axis: "x" | "y" | "z"; direction: 1 | -1; }
  | { kind: "plane"; normal: "x" | "y" | "z"; }
  | { kind: "center"; }
  | { kind: "view"; };
```

A rotate ring reports `kind: "axis"`. A plane handle is named by its normal, so
`normal: "y"` moves on X and Z.

Rings measure the true angle around their axis. A ring seen nearly edge-on
falls back to the pointer's travel across the screen, one ring radius per
radian. Scale never goes to zero or mirrors: dragging through the pivot clamps
to a tiny positive factor.

## Orientation

```ts
type TransformOrientation =
  | "world"
  | "local"
  | "parent"
  | "view"
  | THREE.QuaternionLike;
```

| Value | Gizmo axes |
|---|---|
| `"world"` | World axes. Default. |
| `"local"` | The target's world orientation. |
| `"parent"` | The target parent's world orientation, or world axes without a parent. |
| `"view"` | The camera orientation: X right, Y up, Z toward the viewer. |
| quaternion | A fixed world orientation. Normalized and copied. |

Scale gestures always use `"local"`, since a non-uniform scale along foreign
axes would shear the target. A gesture latches its orientation when it starts.

## Pivot

```ts
type TransformPivot =
  | "origin"
  | THREE.Vector3Like
  | THREE.Object3D;
```

The pivot is where the gizmo sits and the fixed point of rotation and scaling.

| Value | Meaning |
|---|---|
| `"origin"` | The target's own position. Default. |
| vector | A point in the target's local space. It travels with the target. |
| object | Any object, followed in world space. |

```ts
controls.pivot = { x: 0, y: -0.5, z: 0 };
```

Rotating or scaling around a pivot also moves the target so that the pivot
stays put. With `"origin"` the position is never touched by those modes.

## Snapping

```ts
interface TransformSnapOptions {
  translate?: number | THREE.Vector3Like | null;
  rotate?: number | null;
  scale?: number | null;
}
```

| Step | Applies to |
|---|---|
| `translate` | Distance travelled from the gesture start, shared or per gizmo axis. An object at `x = 0.25` with a step of `1` moves to `1.25`, `2.25`. |
| `rotate` | The gesture angle, in radians. |
| `scale` | The resulting scale value, so `0.5` yields `0.5`, `1`, `1.5`. |

Omitted steps are `null`, which means free movement. Assigning `snap` replaces
all three. Hold <kbd>Alt</kbd> during a pointer move to suspend snapping.

## Axes and limits

```ts
controls.axes = { y: false };
controls.limits = new THREE.Box3(min, max);
```

A disabled axis hides every handle that involves it, plane handles included.
`limits` clamps translation in the target parent's space.

## Appearance

```ts
interface TransformGizmoAppearanceOptions {
  size?: number;
  gap?: number;
  directions?: "positive" | "negative" | "both";
  handle?: TransformAxisHandleOptions;
  scaleHandle?: TransformAxisHandleOptions;
  axes?: TransformAxesAppearanceOptions;
  center?: false | TransformCenterAppearanceOptions;
  planes?: false | TransformPlaneAppearanceOptions;
  rings?: TransformRingAppearanceOptions;
  viewRing?: false | TransformViewRingAppearanceOptions;
  outline?: false | TransformOutlineOptions;
  picker?: TransformPickerOptions;
  hoverColor?: THREE.ColorRepresentation;
  activeColor?: THREE.ColorRepresentation;
  hideAligned?: boolean;
  flipTowardCamera?: boolean;
  depthTest?: boolean;
  renderOrder?: number;
}
```

| Option | Default | Description |
|---|---:|---|
| `size` | `0.09` | Gizmo size as a fraction of the camera scale. |
| `gap` | `0` | Empty distance between the origin and each axis handle. At `0` the shafts join at the origin. |
| `directions` | `"positive"` | Direction policy of translate and scale axis handles. |
| `handle` | `{ kind: "arrow" }` | Translate handle shape. |
| `scaleHandle` | `{ kind: "cube" }` | Scale handle shape. |
| `center` | `false` | Origin sphere. Visual-only unless `interactive: true`. |
| `planes` | see below | Two-axis handles. `false` omits them. |
| `rings` | radius `1`, tube `0.022`, `frontOnly: true` | Rotate rings. `frontOnly` draws the camera-facing half of each ring, closed by a silhouette circle; `false` draws full rings. |
| `viewRing` | radius `1.25` | Screen-facing rotate ring. `false` omits it. |
| `outline` | dark, width `2` | Silhouette behind each handle. `width` is in CSS pixels and stays constant under any view angle. Plane handles have none and use their own `border`. |
| `picker.radius` | `0.16` | Radius of the invisible axis picker. |
| `picker.lengthScale` | `1` | Axis picker length relative to the handle. |
| `picker.ringTube` | `0.08` | Tube radius of the invisible ring picker. |
| `hideAligned` | `false` | Hide axis handles pointing at the camera and plane handles seen edge-on. |
| `flipTowardCamera` | `false` | Point single-direction axis handles and plane handles toward the camera. |
| `depthTest` | `false` | Whether scene depth may hide the helper. |
| `renderOrder` | `20` | Outline render order, shared by the plane handles. Colored axis handles use the next value, sorted by depth, and the center the two after. |

Dimensions use normalized gizmo units; the helper receives the camera-relative
scale afterwards. Every visible material is transparent so the helper is drawn
in the transparent render pass, where `depthTest` and `renderOrder` can keep it
above a scene's own transparent geometry.

Appearance is resolved at construction. Recreate the controls to change it.

The junction of the axis handles starts no gesture: pressing the origin is
left to the center handle when it is interactive, which also wins over any
plane handle reaching into it.

With `hideAligned` off, every handle stays visible, and one that cannot be
dragged from the current view simply refuses to start a gesture. A plane
handle seen edge-on is not picked at all.

### Plane handles

```ts
interface TransformPlaneAppearanceOptions {
  size?: number;
  inset?: number;
  opacity?: number;
  border?: false | number;
  color?: "normal" | "blend";
}
```

| Option | Default | Description |
|---|---:|---|
| `size` | `0.3` | Edge length of the square. |
| `inset` | hub reach, at least `0.03` | Distance between the two in-plane axes and the inner edges. The default follows `gap` and the center handle, so the inner corner rests against the hub whatever the `size`. |
| `opacity` | `0.3` | Fill opacity. |
| `border` | `0.02` | Thickness of the opaque strip on the two outer edges. `false` omits it. |
| `color` | `"normal"` | `"normal"` uses the color of the normal axis, `"blend"` the mix of the two in-plane axis colors. |

A plane handle is a flat, double-sided square in the quadrant of its two axes.
It draws below the axis handles and can be picked from either side.

### Handle shapes

```ts
type TransformAxisHandleOptions =
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
  }
  | {
    kind: "cube";
    shaftLength?: number;
    shaftRadius?: number;
    size?: number;
    radialSegments?: number;
  }
  | {
    kind: "slab";
    shaftLength?: number;
    shaftRadius?: number;
    size?: number;
    depth?: number;
    radialSegments?: number;
  };
```

### Per-axis overrides

```ts
const controls = new TransformControls(camera, canvas, {
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

An axis set to `false` has no arrow, ring or scale handle, and removes the two
plane handles that involve it. Use the live `axes` property instead to toggle
axes at runtime.

### Center

```ts
center: {
  color: "#ffffff",
  radius: 0.1,
  radialSegments: 24,
  interactive: true,
  outline: {
    color: "#080b11"
  }
}
```

An omitted `center.outline` inherits the gizmo outline. Without `interactive`
the marker owns no picker, and pressing the origin starts nothing. The center
is always drawn above the axis handles.

## Properties

```ts
readonly helper: THREE.Object3D;
get camera(): THREE.Camera;
get target(): THREE.Object3D | null;
get dragging(): boolean;
get hoveredHandle(): TransformHandle | null;
get activeHandle(): TransformHandle | null;

mode: "translate" | "rotate" | "scale";
orientation: TransformOrientation;
pivot: TransformPivot;
snap: TransformSnapOptions;
axes: { x?: boolean; y?: boolean; z?: boolean; };
limits: THREE.Box3 | null;
```

Add `helper` to the rendered scene. It shows on `attach()` and hides on
`detach()`. Changing `mode` or `axes` ends an active gesture. Vectors and
quaternions read back from `orientation`, `pivot` and `snap` are copies.

`object` is the camera, as on every `THREE.Controls`. The attached object is
`target`.

## Methods

### `attach()` and `detach()`

```ts
attach(target: THREE.Object3D): void;
detach(): void;
```

Gestures are computed in world space and converted into the target parent's
local coordinates, so translated, rotated and scaled parents are supported.
Reparenting the target during a gesture ends that gesture.

### `cancel()`

```ts
cancel(): void;
```

Ends the active gesture and restores the transform it started from.
<kbd>Escape</kbd> does the same while a gesture runs.

### `isOverHandle()`

```ts
isOverHandle(event: PointerEvent): boolean;
```

Use this during capture-phase scene selection so a handle wins over an object
behind it.

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

| Event | Fired |
|---|---|
| `start` | A handle claims the primary pointer. |
| `change` | The target reaches a new effective transform. A cancelled gesture that had moved the target fires one more for the restore. |
| `end` | The gesture ends, is cancelled or is interrupted. |

```ts
interface TransformGestureEvent {
  mode: "translate" | "rotate" | "scale";
  handle: TransformHandle;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  worldPosition: THREE.Vector3;
}
```

`position`, `quaternion` and `scale` are the target's local transform.
All four values are safe-to-keep copies. `end` adds `changed` and `cancelled`.

Use `start` and `end` to suspend camera controls:

```ts
controls.addEventListener("start", () => {
  orbit.enabled = false;
});
controls.addEventListener("end", () => {
  orbit.enabled = true;
});
```
