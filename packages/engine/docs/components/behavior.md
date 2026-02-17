# Behavior

A `Behavior` is a specialized
[ActorComponent](../actor/actor-component.md) that adds scripting
capabilities to an Actor. It provides:

- **Actor registration** — each behavior registers itself on
  `actor.behaviors`, making it discoverable from other actors
- **Decorators** — declarative metadata for scene properties,
  component references, input listeners, and
  [signals](../actor/signal.md)

```ts
import {
  Behavior,
  type BehaviorProperties,
  ModelRenderer,
  Input,
  SceneProperty,
  SceneActorComponent,
  Signal,
  type SignalEvent
} from "@jolly-pixel/engine";

export interface PlayerProperties extends BehaviorProperties {
  speed: number;
}

export class PlayerBehavior extends Behavior<PlayerProperties> {
  @Signal()
  onPlayerPunch: SignalEvent;

  @SceneProperty({ type: "number" })
  speed = 0.05;

  @SceneActorComponent(ModelRenderer)
  model: ModelRenderer;

  awake() {
    this.actor.object3D.rotateX(-Math.PI / 2);

    this.model.animation.setClipNameRewriter(
      (name) => name.slice(name.indexOf("|") + 1).toLowerCase()
    );
    this.model.animation.play("idle_loop");
    this.model.animation.setFadeDuration(0.25);
  }

  fixedUpdate() {
    const { input } = this.actor.world;

    if (input.isMouseButtonDown("left")) {
      this.onPlayerPunch.emit();
    }
  }

  update() {
    const { input } = this.actor.world;

    if (input.isMouseButtonDown("left")) {
      this.model.animation.play("punch_jab");
    }
    else {
      this.model.animation.play("idle_loop");
    }
  }
}
```

## Decorators

### `@SceneProperty`

Exposes a field as a configurable property in the scene editor.
Supported types: `string`, `number`, `boolean` (and their array
variants), `Vector2`, `Vector3`, `Vector4`, `Color`.

```ts
@SceneProperty({ type: "number", label: "Speed", description: "Movement speed" })
speed = 0.05;
```

### `@SceneActorComponent`

Binds a field to a sibling component on the same actor. The
component reference is resolved automatically during initialization.

```ts
@SceneActorComponent(ModelRenderer)
model: ModelRenderer;
```

### `@Signal`

Declares a [SignalEvent](../actor/signal.md) property on the
behavior. See the dedicated documentation for the full API.

```ts
@Signal()
onPlayerPunch: SignalEvent;
```

### `@Input.listen`

Binds a method to an input event. The listener is wired
automatically during behavior initialization.

```ts
@Input.listen("keyboard.down")
onKeyDown(event: KeyboardEvent) {
  // …
}
```

## Properties

Behaviors support typed runtime properties through the generic
parameter `T extends BehaviorProperties`:

```ts
type BehaviorPropertiesValue =
  | string | string[]
  | number | number[]
  | boolean | boolean[]
  | THREE.Vector2
  | THREE.Vector3;

type BehaviorProperties = Record<string, BehaviorPropertiesValue>;
```

```ts
interface Behavior<T extends BehaviorProperties> {
  setProperty<K extends keyof T>(name: K, value: T[K]): void;
  getProperty<K extends keyof T>(name: K, defaultValue: T[K]): T[K];
  mergeProperties(defaults?: Partial<T>): void;
}
```

## See also

- [ActorComponent](../actor/actor-component.md)
- [Signal](./signal.md)
