# Signal

Inspired by [Godot's signals](https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html),
signals are a lightweight pub/sub mechanism for communication
between [behaviors](../components/behavior.md). A signal is named in the past
tense after what happened: `clicked`, `entered`, `damaged`.

## Declaring a signal

```ts
import {
  Behavior,
  SignalEvent
} from "@jolly-pixel/ecs";

export class PlayerBehavior extends Behavior {
  readonly punched = new SignalEvent();

  update() {
    if (this.actor.world.input.mouse.isDown("left")) {
      this.punched.emit();
    }
  }
}
```

## Listening to a signal

`connect` returns a connection whose `disconnect()` removes that listener:

```ts
const player = actor.findComponent(PlayerBehavior)!;

const connection = player.punched.connect(() => {
  console.log("Player punched!");
});
connection.disconnect();
```

A component listens with [`listen`](../actor/actor-component.md#listen), which
binds `this` and disconnects when the component is destroyed:

```ts
export class Scoreboard extends Behavior {
  @SceneActorComponent(PlayerBehavior)
  player: PlayerBehavior;

  score = 0;

  awake() {
    this.listen(this.player.punched, this.onPunch);
  }

  onPunch() {
    this.score++;
  }
}
```

`next()` resolves with the arguments of the following emit:

```ts
const [amount, source] = await health.damaged.next();
```

## SignalEvent API

```ts
interface SignalEvent<T extends unknown[] = []> {
  // Notify all connected listeners
  emit(...args: T): void;

  // Subscribe a listener
  connect(
    listener: SignalListener<T>,
    options?: SignalConnectOptions
  ): SignalConnection;

  // Resolve with the arguments of the next emit
  next(): Promise<T>;

  // Remove all listeners
  clear(): void;
}

interface SignalConnectOptions {
  once?: boolean; // disconnect before the first call, default false
}

interface SignalConnection {
  disconnect(): void;
}

type SignalListener<T extends unknown[]> = (...args: T) => void;
```

`emit()` calls the listeners connected when it starts. A listener
connected or disconnected during an emit takes effect on the next one. A
listener that throws stops the emit.

## Typed signals

`SignalEvent` accepts a generic tuple to type the emitted arguments:

```ts
readonly damaged = new SignalEvent<[amount: number, source: string]>();

// Emit with typed arguments
this.damaged.emit(10, "fireball");

// Listener receives typed parameters
health.damaged.connect((amount, source) => {
  console.log(`Took ${amount} damage from ${source}`);
});
```

The scene editor reads the tuple labels as the signal's parameter names.

## Scene connections

A [scene file](../systems/scene-file.md#connections) can wire a signal of one
component to a method of another, so neither script references the other. The
scene editor edits them in its Signals pane.

## See also

- [Behavior](./behavior.md)
- [ActorComponent](../actor/actor-component.md)
