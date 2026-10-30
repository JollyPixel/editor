# Behavior

A `Behavior` is the [ActorComponent](../actor/actor-component.md) for game
scripts. Decorators declare its scene properties, component references and
input listeners; [signals](./signal.md) let other scripts react to it.

```ts
import {
  Behavior,
  ModelRenderer,
  SceneProperty,
  SceneActorComponent,
  SignalEvent
} from "@jolly-pixel/engine";

export class PlayerBehavior extends Behavior {
  onPlayerPunch = new SignalEvent();

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

    if (input.mouse.isDown("left")) {
      this.onPlayerPunch.emit();
    }
  }

  update() {
    const { input } = this.actor.world;

    if (input.mouse.isDown("left")) {
      this.model.animation.play("punch_jab");
    }
    else {
      this.model.animation.play("idle_loop");
    }
  }
}
```

## Decorators

Decorators are resolved right before `awake()`, so a component referenced
with `@SceneActorComponent` may be added to the actor in any order before it
awakes. Input listeners are removed when the behavior is destroyed.

### `@SceneProperty`

Exposes a field as a configurable property in the scene editor.
Supported types: `string`, `number`, `boolean` (and their array
variants), `Vector2`, `Vector3`, `Vector4`, `Color`.

```ts
@SceneProperty({ type: "number", label: "Speed", description: "Movement speed" })
speed = 0.05;
```

A field left `undefined` gets the type default: `""`, `0`, `false`, an empty
array, a zero vector, or black.

The `Actor` type references another actor, stored by `persistentId` in a
scene file. An id no live actor holds logs a warning and leaves `null`. The
reference is not cleared when the target is destroyed: check
`pendingForDestruction` before using it.

```ts
@SceneProperty({ type: "Actor" })
target: Actor | null = null;
```

### `@SceneActorComponent`

Binds a field to a sibling component on the same actor.

```ts
@SceneActorComponent(ModelRenderer)
model: ModelRenderer;
```

### `@InputListener`

Binds a method to an input event by its `InputListenerType` dot-path name,
from `@jolly-pixel/controls`.

```ts
@InputListener("keyboard.down")
onKeyDown(event: KeyboardEvent) {
  // …
}
```

## Properties

`properties` passed as an option are assigned to the behavior's fields after
its field initializers, before `@SceneProperty` defaults resolve:

```ts
actor.addComponent(PlayerBehavior, {
  properties: { speed: 0.1 }
});
```

## Scene files

A [scene file](../systems/scene-file.md) names a behavior by a string,
because minified builds rename classes. Give `ScriptDefinition` a record
from each name to its behavior class:

```ts
const script = new ScriptDefinition({
  Player: PlayerBehavior
});
```

```ts
interface ScriptData {
  behavior: string;
  properties: JSONObject;
}
```

- Each value in `properties` is converted through the field's
  `@SceneProperty` type: `[0, 1, 0]` becomes a `Vector3` and `"#ff0000"` a
  `Color`. A value that does not fit the type is dropped, so the field keeps
  its initializer. A key without a `@SceneProperty` field is ignored.
- An unregistered name logs a warning and builds no behavior. Edit mode
  builds none either.
- `capture(behavior)` writes each `@SceneProperty` field back in its stored
  form. `owns(component)` accepts instances of a registered class, not of a
  subclass.
- `SCENE_PROPERTY_TYPES` lists the value types (`Actor` excluded;
  `BehaviorPropertyType` includes it). `inferScenePropertyType(value)` guesses
  one from a stored value, or returns `null`.

## See also

- [ActorComponent](../actor/actor-component.md)
- [Signal](./signal.md)
