# World

`World` wires the [SceneManager](scene-manager.md), the
[Renderer](renderer.md), input and [audio](../audio/audio.md) together and
runs the frame loop. A game has one world, reached as `actor.world`.

## Creating a game instance

```ts
import { Systems } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const sceneManager = new Systems.SceneManager();
const renderer = await Systems.ThreeRenderer.create(canvas);

const game = new Systems.World(renderer, { sceneManager, assetCoordinator });
```

The constructor accepts a [Renderer](renderer.md) and a
`WorldOptions` object:

```ts
interface WorldOptions {
  /** The scene that manages actors and components. */
  sceneManager: SceneManager;
  /** Loads the assets scenes declare. */
  assetCoordinator: AssetCoordinator;
  /** Input system for keyboard, mouse, gamepad, etc. @default auto-created from canvas */
  input?: Input;
  /** Global audio manager. @default new GlobalAudio() */
  audio?: GlobalAudio;
  /** Read by components as `this.context`. @default {} */
  context?: TContext;
  /** Enable the exit mechanism on the input system. @default false */
  enableOnExit?: boolean;
  /** Abstraction over global references (useful for testing). @default BrowserGlobalsAdapter */
  globalsAdapter?: GlobalsAdapter;
  /** Logs everything (level "trace", namespaces ["*"]). @default false */
  debug?: boolean;
  /** Logger settings. Each option set here overrides the `debug` default. */
  logger?: LoggerOptions;
}
```

## Connect and disconnect

`connect()` connects input, starts observing the canvas size and awakes the
scene:

```ts
game.connect();
```

`disconnect()` disconnects input and stops observing the canvas:

```ts
game.disconnect();
```

## Dispose

`dispose()` stops the loop, disconnects, and disposes the
[renderer](renderer.md):

```ts
game.dispose();
```

Call it whenever a world is dropped. Browsers cap the number of live GPU
contexts, so a leaked one eventually stops rendering. The world must not be
used after disposal.

## Game loop

`World` reads no clock: the caller owns one `FrameScheduler` from
`@jolly-pixel/loop` and passes each `FrameSchedule` to `tick()`.

```ts
import { FrameScheduler } from "@jolly-pixel/loop";

const scheduler = new FrameScheduler({ fixedFps: 60, maxFps: 144 });

world.start();

function loop(now: number) {
  const exited = world.tick(scheduler.advance(now));
  if (exited) { /* stop loop */ }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

Under `@jolly-pixel/runtime`, its `GameLoop` calls `tick()`. Configure timing
there:

```ts
runtime.loop.scheduler.fixedFps = 60;  // simulation rate
runtime.loop.scheduler.maxFps = 144;   // render cap, independent of fixedFps
runtime.loop.timeScale = 0.5;          // slow motion; 0 pauses the simulation
```

#### `tick(schedule)`

Runs one frame of `schedule` as given; the world has no accumulator, so tests
and editors can replay any frame. Returns `true` when the input system asked
to exit.

One frame, in order:

1. `sceneManager.beginFrame()`, then the time and timers advance and input
   is sampled once.
2. `schedule.steps` fixed steps, each preceded by `input.publish("step")`.
3. On a drawn frame, `input.publish("frame")`, then
   `sceneManager.update(deltaTime, alpha)`, then the draw.
4. `sceneManager.endFrame()`, which destroys pending components and actors.
   On exit, the renderer is cleared.

#### `fixedUpdate(deltaTime, stepIndex)`

Runs 0 to `maxStepsPerFrame` times per frame, always with the same delta.
`stepIndex` counts the steps within the frame, from zero.

A press edge reaches the first step that runs after it, and only that one.
A frame with no step keeps it for the next step, so `fixedUpdate` never
misses a press in slow motion or while paused.

#### `update(deltaTime, alpha)`

Runs once per drawn frame. `alpha` is how far the frame sits between the last
fixed step and the next one, in `[0, 1)`. The engine does not interpolate
transforms: a component that moves an actor in `fixedUpdate` interpolates it
here, for example with `Interpolated` from `@jolly-pixel/loop`, or the motion
looks choppy.

```ts
class Mover extends Behavior {
  speed = 4;
  #x = new Interpolated(0, lerpNumber);

  fixedUpdate(deltaTime: number) {
    this.#x.push(this.#x.current + (this.speed * deltaTime));
  }

  update(_deltaTime: number, alpha: number) {
    this.actor.transform.setLocalPosition({ x: this.#x.at(alpha), y: 0, z: 0 });
  }
}
```

`update` sees each input edge once, however many fixed steps the frame ran.
A frame suppressed by `maxFps` skips `update` and the draw, but still
accumulates time and still runs its fixed steps.

### Time

`world.time` is a `WorldTime` updated by `tick()`, in seconds:

| Property | Meaning |
| --- | --- |
| `delta` | Game time since the previous `update`, frames skipped by `maxFps` included. Follows `timeScale`, `0` while paused. Same value as the `update` delta. |
| `unscaledDelta` | Wall-clock time since the previous `update`, clamped like game time. Ignores `timeScale` and pause. |
| `elapsed` | Game time received so far. |
| `unscaledElapsed` | Wall-clock time received so far, clamped. |
| `fixedElapsed` | Game time consumed by completed fixed steps. Inside `fixedUpdate` it is the start time of the running step. |

Cameras, UI motion and debug tools read `unscaledDelta` to keep their speed
in slow motion and while paused.

```ts
const { time } = this.actor.world;

if (time.fixedElapsed - this.lastShot >= 2) {
  this.lastShot = time.fixedElapsed;
}
```

A tick on a stopped world does not advance the time.

### Timers

`world.timers` counts game time: its timers follow `timeScale` and wait while
paused.

```ts
interface TimerOptions {
  /** @default false */
  repeat?: boolean;
}

interface Timer {
  readonly active: boolean;
  cancel(): void;
}

class Timers {
  get pending(): boolean;
  schedule(
    seconds: number,
    callback: () => void,
    options?: TimerOptions
  ): Timer;
  advance(now: number): void;
}
```

- `schedule()` throws a `RangeError` for a negative delay, and for a
  repeating timer without delay.
- Timers due in the same tick fire in due order. One cancelled by an earlier
  callback of that tick does not fire.
- The world keeps animating while `pending` is `true`.
- Components use
  [`ActorComponent.schedule`](../actor/actor-component.md#timers), which
  cancels their timers on destruction.

## Rendering on demand

A host can stop ticking while nothing changes, as the runtime's
`renderOnDemand` option does. The world tells it when frames are needed:

```ts
type WorldKeepAlive = () => boolean;

invalidate(): void;
keepAlive(predicate: WorldKeepAlive): () => void;
get animating(): boolean;
```

- `invalidate()` emits `invalidate`. Call it after changing what is drawn
  from outside a frame, such as from a network callback.
- `keepAlive()` keeps frames coming while its predicate returns `true`. It
  invalidates once and returns a function removing the predicate.
- `animating` is `true` while any predicate returns `true`.

```ts
const release = this.actor.world.keepAlive(() => this.fading);
this.addTeardown(release);
```

A host that ticks every frame ignores both, so components can call them
unconditionally.

To keep frames going while any component updates:

```ts
world.keepAlive(() => world.sceneManager.actors.updating);
```

## Accessing subsystems

Actors and components can access every subsystem through public
`World` properties:

```ts
// From inside a Behavior
const { input, sceneManager, audio, renderer } = this.actor.world;

if (input.keyboard.isDown("Space")) {
  audio.play("jump");
}
```

## See also

- [SceneManager](scene-manager.md): actor tree, lifecycle, and destruction
- [Scene files](scene-file.md): `FileScene` and component definitions
- [Renderer](renderer.md): rendering pipeline
- [Logger](logger.md): `world.logger`, namespaces and steps
- [Actor](../actor/actor.md): the engine's core entity
