## Signal

Inspired by [Godot's signals](https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html),
signals are a lightweight pub/sub mechanism for communication
between [behaviors](../components/behavior.md). A `SignalEvent`
is declared on a behavior with the `@Signal()` decorator and
instantiated automatically during initialization.

### Declaring a signal

```ts
import {
  Behavior,
  Signal,
  type SignalEvent
} from "@jolly-pixel/engine";

export class PlayerBehavior extends Behavior {
  @Signal()
  onPlayerPunch: SignalEvent;

  update() {
    if (this.actor.gameInstance.input.isMouseButtonDown("left")) {
      this.onPlayerPunch.emit();
    }
  }
}
```

### Listening to a signal

Other behaviors can subscribe to a signal with `connect` and
unsubscribe with `disconnect`:

```ts
const player = actor.getBehavior(PlayerBehavior)!;

player.onPlayerPunch.connect(() => {
  console.log("Player punched!");
});
```

### SignalEvent API

```ts
interface SignalEvent<T extends unknown[] = []> {
  // Notify all connected listeners
  emit(...args: T): void;

  // Subscribe a listener
  connect(listener: SignalListener<T>): void;

  // Unsubscribe a listener
  disconnect(listener: SignalListener<T>): void;

  // Remove all listeners
  clear(): void;
}

type SignalListener<T extends unknown[]> = (...args: T[]) => void;
```

### Typed signals

`SignalEvent` accepts a generic tuple to type the emitted arguments:

```ts
@Signal()
onDamage: SignalEvent<[amount: number, source: string]>;

// Emit with typed arguments
this.onDamage.emit(10, "fireball");

// Listener receives typed parameters
behavior.onDamage.connect((amount, source) => {
  console.log(`Took ${amount} damage from ${source}`);
});
```

### See also

- [Behavior](./behavior.md)
- [ActorComponent](../actor/actor-component.md)
