# Camera3DControls

A first-person camera controller. It extends
[CameraComponent](camera.md), attaches the audio listener, and
handles WASD movement with mouse-look rotation. Movement is applied
to the **actor's transform**, which is what drives the camera.

## Usage

```ts
import { Actor, Camera3DControls } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Camera" });
actor.addComponent(Camera3DControls, {
  speed: 15,
  rotationSpeed: 0.003,
  far: 4096,
  bindings: {
    forward: "KeyW",
    backward: "KeyS",
    left: "KeyA",
    right: "KeyD",
    up: "Space",
    down: "ShiftLeft",
    lookAround: "middle"
  }
});
```

Place the camera through the actor:

```ts
actor.addComponent(Camera3DControls, {}, (component) => {
  component.actor.transform
    .setLocalPosition({ x: 10, y: 10, z: 5 })
    .lookAt({ x: 0, y: 0, z: 0 });
});
```

## Options

`Camera3DControlsOptions` extends
[`CameraOptions`](camera.md#options), so `fov`, `near`, `far`,
`projectionMode`, `orthographicScale`, `viewport` and `depth` all
work here.

```ts
interface Camera3DControlsOptions extends CameraOptions {
  speed?: number;
  rotationSpeed?: number;
  maxRollUp?: number;
  maxRollDown?: number;
  bindings?: {
    forward?: InputKeyboardAction;
    backward?: InputKeyboardAction;
    left?: InputKeyboardAction;
    right?: InputKeyboardAction;
    up?: InputKeyboardAction;
    down?: InputKeyboardAction;
    lookAround?: MouseEventButton;
  };
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `speed` | `7.5` | Movement speed in world units per second |
| `rotationSpeed` | `1` | Mouse look sensitivity |
| `maxRollUp` | `π / 2` | Maximum upward pitch (radians) |
| `maxRollDown` | `-π / 2` | Maximum downward pitch (radians) |
| `bindings` | WASD + Space/Shift + middle mouse | Key and mouse bindings |
| `addAudioListener` | `true` | Unlike the base `CameraComponent`, which defaults to `false` |

## Runtime properties

```ts
interface Camera3DControls {
  // The underlying Three.js camera. Read-only as far as the transform
  // goes — see CameraComponent.
  camera: THREE.PerspectiveCamera;

  // Change movement speed at runtime
  set speed(value: number);

  // Change rotation speed at runtime
  set rollSpeed(value: number);
}
```

## See also

- [Camera](camera.md)
- [ActorComponent](../actor/actor-component.md)
