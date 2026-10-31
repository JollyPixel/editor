# OrbitFlyCamera

A WASD + mouse-look fly [CameraComponent](camera.md) that can also pivot:
`focusMode: "lock"` orbits a fixed point, and `focusMode: "elastic"` trails
a pivot that WASD and look steer. It moves by wall-clock time
([`world.time.unscaledDelta`](../systems/world.md#time)), so it keeps its
speed in slow motion and while paused.

## Usage

```ts
import { Actor, OrbitFlyCamera } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Camera" });
actor.addComponent(OrbitFlyCamera, {
  position: { x: 8, y: 12, z: 32 },
  focusMode: "lock"
});
```

`focusMode: "elastic"` trails a free-floating pivot instead:

```ts
actor.addComponent(OrbitFlyCamera, {
  focusMode: "elastic",
  pivotPosition: { x: 0, y: 2, z: 0 },
  initialTrailDistance: 12
});
```

## Options

`OrbitFlyCameraOptions` extends [`CameraOptions`](camera.md#options), so
`near`, `projectionMode`, `orthographicScale`, `viewport`, `depth`,
`addAudioListener` and `postProcessing` all work here. Only the `fov` and
`far` defaults differ.

```ts
import { pass } from "three/tsl";

actor.addComponent(OrbitFlyCamera, {
  far: 5000,
  postProcessing: ({ scene, camera }) => {
    return pass(scene, camera);
  }
});
```

```ts
type OrbitFlyCameraFocusMode = "none" | "lock" | "elastic";

interface OrbitFlyCameraOptions extends CameraOptions {
  position?: THREE.Vector3Like;
  pivotPosition?: THREE.Vector3Like;
  initialTrailDistance?: number;
  yaw?: number;
  pitch?: number;
  moveSpeed?: number;
  minMoveSpeed?: number;
  maxMoveSpeed?: number;
  accelerationTime?: number;
  brakingTime?: number;
  responsiveness?: number;
  mouseSensitivity?: number;
  touchpadLookSensitivity?: number;
  touchpadSwipe?: TouchpadSwipeMode; // "look" | "pan"
  invertY?: boolean;
  keyLookSpeed?: number;
  keys?: OrbitFlyKeys;
  maxPitch?: number;
  scrollSpeed?: number;
  speedAdjustStep?: number;
  focusMode?: OrbitFlyCameraFocusMode;
  minPivotDistance?: number;
  maxPivotDistance?: number;
  pivotZoomStep?: number;
  pivotNudgeStep?: number;
  showPivotMarker?: boolean;
  fov?: number;
  far?: number;
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `position` | `{ x: 16, y: 20, z: 40 }` | Starting camera position |
| `pivotPosition` | `position` | "elastic" mode's pivot the camera starts trailing behind |
| `initialTrailDistance` | `0` | "elastic" mode's starting trail distance, in world units |
| `yaw` / `pitch` | `0` / `-0.2` | Starting orientation, in radians |
| `moveSpeed` | `18` | Cruise speed in units per second |
| `minMoveSpeed` / `maxMoveSpeed` | `2` / `240` | Bounds for the scroll-adjusted `moveSpeed`; a min above the max throws a `RangeError` |
| `accelerationTime` | `0.15` | Seconds to ease into a new cruise velocity; `0` starts at full speed |
| `brakingTime` | `0.1` | Seconds to glide to a stop once the movement keys are released; `0` stops at once |
| `responsiveness` | `18` | Frame-rate-independent damping rate of the "lock" pivot and distance and the "elastic" trail distance, in 1/s |
| `mouseSensitivity` | `0.003` | Mouse-look sensitivity |
| `touchpadLookSensitivity` | `0.36` | Radians turned per wheel notch of a two-finger touchpad swipe; a negative value inverts it |
| `touchpadSwipe` | `"look"` | `"look"`: a two-finger swipe turns the camera. `"pan"`: it moves the camera sideways and up or down, a twentieth of `moveSpeed` per notch. While a "lock" pivot is engaged, a swipe always orbits |
| `invertY` | `false` | Turns the camera down when the mouse or the fingers move up. The look keys keep their direction |
| `keyLookSpeed` | `π / 2` | Radians per second turned while a look key is held |
| `keys` | `OrbitFlyKeys.default` | The keys held to fly and look around, see [Keys](#keys) |
| `maxPitch` | `π / 2 - 0.01` | Maximum look-up/down pitch, in radians |
| `scrollSpeed` | `2.5` | Trail distance changed per wheel notch in "elastic" mode, in world units |
| `speedAdjustStep` | `0.15` | Fraction `moveSpeed` grows per wheel notch in "none" mode, and in "lock" mode while not orbiting |
| `focusMode` | `"none"` | `"none"`: no pivot. `"lock"`: `enterOrbitFocus` engages a fixed pivot; scroll adjusts distance; `exitOrbitFocus` or `teleport` releases it. `"elastic"`: WASD/look pilot a free-floating pivot; scroll trails the camera behind it, reaching 0 (free-fly) at full zoom-in |
| `minPivotDistance` / `maxPivotDistance` | `1` / `200` | Bounds for the scroll-adjusted pivot distance in "lock" mode; `minPivotDistance` must be greater than 0 and at most `maxPivotDistance`, or the constructor throws a `RangeError`. `maxPivotDistance` also doubles as "elastic" mode's max trail distance |
| `pivotZoomStep` | `0.1` | While orbiting in "lock" mode, each wheel notch multiplies or divides the pivot distance by `1 + pivotZoomStep` |
| `pivotNudgeStep` | `1` | Distance nudged per key press while orbiting in "lock" mode |
| `showPivotMarker` | `true` | Draws a marker at the pivot in "lock" and "elastic" modes |
| `fov` | `60` | Vertical field of view, in degrees |
| `far` | `2000` | Far clipping plane |

By default, movement is WASD or the arrows + Space/Shift (up/down) and
look-around is middle-mouse-drag, Alt+left-drag, or I/J/K/L (look
up/left/down/right). [`keys`](#keys) rebinds the keys. The wheel adjusts `moveSpeed`, or the pivot/trail distance when a focus mode
claims it. Ctrl is reserved for other scroll-driven interactions (e.g. brush
size), so Ctrl+wheel is ignored.

On a touchpad, a two-finger swipe looks around (orbits while a pivot is
locked) and a pinch does what the wheel does. Swipes are told from wheel
notches by `Mouse.scrollSource` of `@jolly-pixel/controls`; set
`input.mouse.scrollDevice` when it guesses wrong.

## Keys

`OrbitFlyKeys` lists the physical keys (`KeyboardEvent.code`) held for each
action. The camera reads held keys, so a binding is one key with no
modifier; `ShiftLeft` or `ControlLeft` alone is a valid binding. While a
"lock" pivot is engaged, pressing a movement key nudges the pivot instead.

```ts
type OrbitFlyAction =
  | "forward" | "back" | "left" | "right" | "up" | "down"
  | "lookUp" | "lookDown" | "lookLeft" | "lookRight";

class OrbitFlyKeys {
  // The default keys listed above.
  static readonly default: OrbitFlyKeys;

  // Reads every action, dropping the strings that are not key codes.
  static from(
    codes: Readonly<Record<OrbitFlyAction, readonly string[]>>
  ): OrbitFlyKeys;

  // An action left out keeps its default keys; an empty list unbinds it.
  constructor(codes?: Partial<Record<OrbitFlyAction, readonly KeyCode[]>>);

  readonly codes: Readonly<Record<OrbitFlyAction, readonly KeyCode[]>>;

  // Down while any key of the action is held; `.pressed` on the frame the
  // first one goes down.
  held(action: OrbitFlyAction): AliasedKeyInput;
}
```

```ts
import { OrbitFlyCamera, OrbitFlyKeys } from "@jolly-pixel/engine";

const camera = actor.addComponentAndGet(OrbitFlyCamera, {
  keys: new OrbitFlyKeys({
    forward: ["KeyE"],
    back: ["KeyD"],
    left: ["KeyS"],
    right: ["KeyF"]
  })
});

// Takes effect on the next frame.
camera.keys = OrbitFlyKeys.default;
```

`ORBIT_FLY_ACTIONS` lists the actions, and `ORBIT_FLY_DEFAULT_KEYS` holds the
default codes.

## Runtime properties

```ts
interface OrbitFlyCamera {
  // The underlying THREE.PerspectiveCamera. Throws while the
  // projectionMode is "orthographic": read threeCamera instead.
  camera: THREE.PerspectiveCamera;

  // Gates all input handling; false freezes the camera in place.
  enabled: boolean;

  // Change moveSpeed at runtime (clamped to minMoveSpeed/maxMoveSpeed).
  set moveSpeed(value: number);

  // The look options, read and written at runtime.
  mouseSensitivity: number;
  touchpadLookSensitivity: number;
  touchpadSwipe: TouchpadSwipeMode;
  invertY: boolean;

  // The keys held to fly and look around.
  keys: OrbitFlyKeys;

  // Whether a "lock" pivot is engaged, or an "elastic" pivot has a
  // non-zero trail distance.
  get isOrbiting(): boolean;

  // The current pivot position, or null when not orbiting.
  get orbitPivot(): THREE.Vector3Like | null;

  // True while the camera glides or its pivot/trail distance damps.
  get moving(): boolean;

  // Snaps position/orientation, dropping any carried momentum. In "elastic"
  // mode the pivot moves to keep its trail distance ahead of the new pose;
  // in "lock" mode the orbit is released.
  teleport(pose: CameraPose): void;

  // "lock" mode only: engages a fixed pivot, optionally facing `point`.
  // No-op outside "lock" mode, or while already orbiting.
  enterOrbitFocus(point?: THREE.Vector3Like): void;

  // "lock" mode only: releases the pivot.
  exitOrbitFocus(): void;

  // Releases the pivot and teleports to the frameBounds() pose, looking
  // along the actor's forward with the camera's fov unless `options` set them.
  frame(bounds: THREE.Box3, options?: Partial<CameraFramingOptions>): void;

  // Calls `listener` each time isOrbiting changes, with its new value.
  // Returns the unsubscribe function.
  subscribe(
    event: "orbit",
    listener: (orbiting: boolean) => void
  ): () => void;
}
```

```ts
camera.subscribe("orbit", (orbiting) => {
  console.log(orbiting ? "pivot" : "free fly");
});
```

The camera keeps an on-demand host rendering through
[`world.keepAlive()`](../systems/world.md#rendering-on-demand) while it is
enabled and `moving`. `teleport()`, `frame()`, `enterOrbitFocus()` and
`exitOrbitFocus()` call `world.invalidate()`.

## frameBounds(bounds, options): CameraPose

Returns the pose looking at the center of `bounds` along `forward`, far enough
for their bounding sphere to fit the vertical `fov`. Empty bounds frame the
origin from `minDistance`. A `minDistance` above `maxDistance` throws a
`RangeError`.

```ts
interface CameraFramingOptions {
  forward: THREE.Vector3Like;
  fov: number; // degrees
  margin?: number; // 1.2, multiplies the fitting distance
  minDistance?: number; // 0
  maxDistance?: number; // Infinity
}
```

## See also

- [Camera](camera.md)
- [Camera3DControls](camera-3d-controls.md) — simpler always-free-fly alternative
- [ActorComponent](../actor/actor-component.md)
