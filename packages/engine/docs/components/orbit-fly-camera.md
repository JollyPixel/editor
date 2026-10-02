# OrbitFlyCamera

A WASD + mouse-look fly camera. It extends [CameraComponent](camera.md)
and, unlike [Camera3DControls](camera-3d-controls.md), can pivot around a
focus point instead of always flying free: `focusMode: "lock"` orbits a
fixed point at a scroll-adjusted distance, and `focusMode: "elastic"` lets
WASD/look pilot a free-floating pivot that the camera trails behind.
Movement and damping follow wall-clock time
([`world.time.unscaledDelta`](../systems/world.md#time)), so the camera
keeps its speed in slow motion and while the game is paused.

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
  responsiveness?: number;
  mouseSensitivity?: number;
  maxPitch?: number;
  scrollSpeed?: number;
  speedAdjustStep?: number;
  focusMode?: OrbitFlyCameraFocusMode;
  minPivotDistance?: number;
  maxPivotDistance?: number;
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
| `minMoveSpeed` / `maxMoveSpeed` | `2` / `240` | Bounds for the scroll-adjusted `moveSpeed` |
| `responsiveness` | `18` | Frame-rate-independent acceleration and braking rate, in 1/s |
| `mouseSensitivity` | `0.003` | Mouse-look sensitivity |
| `maxPitch` | `π / 2 - 0.01` | Maximum look-up/down pitch, in radians |
| `scrollSpeed` | `2.5` | Pivot distance ("lock", while orbiting) or trail distance ("elastic") changed per wheel notch, in world units |
| `speedAdjustStep` | `0.15` | Fraction `moveSpeed` grows per wheel notch in "none" mode, and in "lock" mode while not orbiting |
| `focusMode` | `"none"` | `"none"`: no pivot. `"lock"`: `enterOrbitFocus` engages a fixed pivot; scroll adjusts distance, only `exitOrbitFocus` releases it. `"elastic"`: WASD/look pilot a free-floating pivot; scroll trails the camera behind it, reaching 0 (free-fly) at full zoom-in |
| `minPivotDistance` / `maxPivotDistance` | `1` / `200` | Bounds for the scroll-adjusted pivot distance in "lock" mode; `maxPivotDistance` also doubles as "elastic" mode's max trail distance |
| `pivotNudgeStep` | `1` | Distance nudged per key press while orbiting in "lock" mode |
| `showPivotMarker` | `true` | Draws a marker at the pivot in "lock" and "elastic" modes |
| `fov` | `60` | Vertical field of view, in degrees |
| `far` | `2000` | Far clipping plane |

Movement is WASD (forward/right) + Space/Shift (up/down); look-around is
middle-mouse-drag or Alt+left-drag. The wheel adjusts `moveSpeed`, or the
pivot/trail distance when a focus mode claims it. Ctrl is reserved for other
scroll-driven interactions (e.g. brush size), so Ctrl+wheel is ignored.

## Runtime properties

```ts
interface OrbitFlyCamera {
  // The underlying THREE.PerspectiveCamera.
  camera: THREE.PerspectiveCamera;

  // Gates all input handling; false freezes the camera in place.
  enabled: boolean;

  // Change moveSpeed at runtime (clamped to minMoveSpeed/maxMoveSpeed).
  set moveSpeed(value: number);

  // Whether a "lock" pivot is engaged, or an "elastic" pivot has a
  // non-zero trail distance.
  get isOrbiting(): boolean;

  // The current pivot position, or null when not orbiting.
  get orbitPivot(): THREE.Vector3Like | null;

  // True while the camera glides or its pivot/trail distance damps.
  get moving(): boolean;

  // Snaps position/orientation, dropping any carried momentum.
  teleport(pose: CameraPose): void;

  // "lock" mode only: engages a fixed pivot, optionally facing `point`.
  // No-op outside "lock" mode, or while already orbiting.
  enterOrbitFocus(point?: THREE.Vector3Like): void;

  // "lock" mode only: releases the pivot.
  exitOrbitFocus(): void;
}
```

The camera keeps an on-demand host rendering through
[`world.keepAlive()`](../systems/world.md#rendering-on-demand) while it is
enabled and `moving`. `teleport()`, `enterOrbitFocus()` and `exitOrbitFocus()`
call `world.invalidate()`.

## See also

- [Camera](camera.md)
- [Camera3DControls](camera-3d-controls.md) — simpler always-free-fly alternative
- [ActorComponent](../actor/actor-component.md)
