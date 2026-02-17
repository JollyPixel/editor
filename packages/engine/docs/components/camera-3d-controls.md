# Camera3DControls

A first-person camera controller built as a
[Behavior](behavior.md). It creates a `PerspectiveCamera`,
attaches the audio listener, and handles WASD movement with
mouse-look rotation.

## Usage

```ts
import { Actor, Camera3DControls } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Camera" });
actor.addComponent(Camera3DControls, {
  speed: 15,
  rotationSpeed: 0.003,
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

## Options

```ts
interface Camera3DControlsOptions {
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
| `speed` | `20` | Movement speed |
| `rotationSpeed` | `0.004` | Mouse look sensitivity |
| `maxRollUp` | `π / 2` | Maximum upward pitch (radians) |
| `maxRollDown` | `-π / 2` | Maximum downward pitch (radians) |
| `bindings` | WASD + Space/Shift + middle mouse | Key and mouse bindings |

## Runtime properties

```ts
interface Camera3DControls {
  // The underlying Three.js camera
  camera: THREE.PerspectiveCamera;

  // Change movement speed at runtime
  set speed(value: number);

  // Change rotation speed at runtime
  set rollSpeed(value: number);
}
```

## See also

- [Behavior](behavior.md)
- [ActorComponent](../actor/actor-component.md)
