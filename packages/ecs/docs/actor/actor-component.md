# ActorComponent

An [Actor](actor.md) has no logic or rendering of its own: each
`ActorComponent` attached to it adds one responsibility. ECS ships
[Behavior](../components/behavior.md), for custom scripting with lifecycle
hooks and decorators. Renderers, cameras, lights and audio components come
from a backend such as `@jolly-pixel/backend.three`.

## Attaching components

Components are added to an actor with `addComponent` or
`addComponentAndGet`:

```ts
const actor = new Actor(world, { name: "Player" });

actor.addComponent(PlayerBehavior, {
  speed: 0.5
});
```

A new component registers itself on the actor and is queued for `start()`.

## Lifecycle


| Hook | When it runs |
| ---- | ------------ |
| `awake()` | Once, when the scene starts or when the actor is added |
| `start()` | Once, on the first frame after the component is created, after its actor's `awake()` |
| `fixedUpdate(deltaTime, stepIndex)` | From the frame of `start()` on, every fixed step, at a constant rate (default 60 Hz). Use for physics and deterministic logic. `stepIndex` counts the steps within the current frame |
| `update(deltaTime, alpha)` | From the frame of `start()` on, every drawn frame, with the elapsed game time in seconds. `alpha` is how far the frame sits between the last fixed step and the next one, in `[0, 1)` |
| `destroy()` | When the actor or component is removed from the scene |

The `update` delta follows the loop time scale and is `0` while paused, when
no fixed step runs either. Read [`world.time`](../systems/world.md#time) for
wall-clock time.

A component that defines `update()` or `fixedUpdate()` gets `needUpdate`.
Pass `needUpdate: false` to `super()` to start without updates:

```ts
super({ actor, typeName: "Sprite", needUpdate: false });
```

Setting the property later adds the component to the update loop
or removes it without destroying it. A component that has not started
yet joins the loop when it starts.

## Destruction

`destroy()` runs once; later calls do nothing. It calls the
protected `onDestroy()` hook, then every teardown registered with
`addTeardown()` in reverse order, then removes the component from
its actor and from the start queue. Override `onDestroy()` rather
than `destroy()` so the bookkeeping cannot be skipped:

```ts
class Spinner extends ActorComponent {
  awake() {
    const onResize = () => this.fit();
    this.actor.world.renderer.on("resize", onResize);
    this.addTeardown(() => this.actor.world.renderer.off("resize", onResize));
  }

  protected override onDestroy(): void {
    this.mesh.geometry.dispose();
  }
}
```

To destroy a component during gameplay, prefer
`actor.removeComponent(component)`, which defers the destruction to
the end of the frame.

## Timers

`schedule(seconds, callback, options?)` calls `callback` once the
delay has passed in game time, so the timer follows the loop time
scale and waits while paused. Pass `{ repeat: true }` to call it
every `seconds` instead. A repeating timer that falls behind fires
once and catches up on the next interval, never in a burst.

```ts
class Spawner extends Behavior {
  awake() {
    this.schedule(2, () => this.spawn(), { repeat: true });
  }
}
```

The returned `Timer` has `cancel()` and an `active` getter. Timers of
a component stop when it is destroyed, and skip their callback while
the component waits for removal. They run on `world.timers`, described
in [World](../systems/world.md#timers).

## Listen

`listen(signal, listener, options?)` connects `listener` to a
[signal](../components/signal.md) with `this` bound to the component, and
disconnects it when the component is destroyed. A plain `signal.connect()`
keeps calling a destroyed component.

```ts
class Door extends Behavior {
  @SceneActorComponent(Lever)
  lever: Lever;

  awake() {
    this.listen(this.lever.pulled, this.open);
  }

  open(force: number) {
    // …
  }
}
```

## API

```ts
interface ActorComponent {
  /** Numeric identifier, counted from 0 in each world. */
  readonly id: number;
  /** Persistent random hex identifier (16 characters). */
  readonly persistentId: string;
  actor: Actor;
  typeName: string;

  /**
   * When true, the component receives update() and fixedUpdate()
   * calls. Automatically set when the component defines either
   * method. Set to false to pause updates without destroying.
   */
  needUpdate: boolean;

  /** Shortcut to `actor.world.context`. */
  get context(): TContext;

  /** Returns a prepared asset value synchronously. */
  protected resolveAsset<TValue>(
    reference: AssetReference<TValue>
  ): TValue;

  /** "alive", then "pending" once removal is queued, then "destroyed". */
  readonly status: ActorStatus;
  /** True while pending and once destroyed. */
  readonly pendingForDestruction: boolean;

  /** Queues the component for removal at the end of the frame. */
  markDestructionPending(): void;

  /** Returns `"$typeName:$id-$persistentId"`. */
  toString(): string;

  /** Runs `teardown` when the component is destroyed. */
  addTeardown(teardown: () => void): void;

  /** Connects `listener` until the component is destroyed. */
  listen<T extends unknown[]>(
    signal: SignalEvent<T>,
    listener: (this: this, ...args: T) => void,
    options?: SignalConnectOptions
  ): SignalConnection;

  /** Calls `callback` after `seconds` of game time. */
  schedule(
    seconds: number,
    callback: () => void,
    options?: { repeat?: boolean; }
  ): Timer;

  /** Remove the component from its actor. Idempotent. */
  destroy(): void;

  /** Override for component-specific cleanup. */
  protected onDestroy(): void;
}
```

## Declaring component assets

A component can expose one public static group and use the same references in
its lifecycle:

```ts
class PlayerBehavior extends ActorComponent {
  static readonly assets = {
    model: new AssetReference("model.player", AssetTypes.model)
  } satisfies AssetReferenceGroup;

  override awake(): void {
    const model = this.resolveAsset(PlayerBehavior.assets.model);
  }
}
```

Pass the group to the owning scene with `assets: [PlayerBehavior.assets]`,
so the lifecycle methods stay synchronous.

## Accessing game context

`context` is a shortcut to `actor.world.context`:

```ts
class PlayerBehavior extends Behavior {
  update() {
    const { score } = this.context;
  }
}
```

## See also

- [Behavior](../components/behavior.md)
- [Signal](../components/signal.md)
