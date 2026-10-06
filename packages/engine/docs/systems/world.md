# World

The `World` is the central orchestrator of the engine. It
wires together the [SceneManager](scene-manager.md),
[Renderer](renderer.md), [Input](../../../controls/docs/input.md),
and [Audio](../audio/audio.md) systems and drives the main
**connect → update → render** loop.

Every project creates exactly one `World`. It is passed to
every [Actor](../actor/actor.md) at construction time and is
available throughout the component tree via `actor.world`.

## Creating a game instance

```ts
import {
  SceneEngine,
  ThreeRenderer,
  World
} from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const sceneManager = new SceneManager();
const renderer = await ThreeRenderer.create(canvas);

const game = new World(renderer, { sceneManager });
```

The constructor accepts a [Renderer](renderer.md) and a
`WorldOptions` object:

```ts
interface WorldOptions {
  /** The scene that manages actors and components. */
  sceneManager: SceneContract;
  /** Input system for keyboard, mouse, gamepad, etc. @default auto-created from canvas */
  input?: Input;
  /** Global audio manager. @default new GlobalAudio() */
  audio?: GlobalAudio;
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

## Loading manager

Three.js assets (models, textures, audio) can share a single
`THREE.LoadingManager` via the game instance:

```ts
const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => {
  console.log(`${loaded}/${total}`);
};

game.setLoadingManager(manager);
```

The loading manager is available from anywhere as
`actor.world.loadingManager`.

## Connect and disconnect

`connect()` starts the game by wiring up input listeners, the
window resize handler, and awakening the scene:

```ts
game.connect();
```

Internally this:

1. Connects the [Input](../../../controls/docs/input.md) system.
2. Registers the renderer's `resize` callback on the window
   adapter.
3. Calls `scene.awake()`, which awakens all existing actors and
   emits the `"awake"` event.

`disconnect()` tears down the listeners:

```ts
game.disconnect();
```

## Dispose

`dispose()` stops the loop, disconnects, and releases the
[renderer](renderer.md)'s WebGL context:

```ts
game.dispose();
```

Call it whenever a world is dropped, such as when closing a scene in
an editor or swapping a canvas. Browsers cap the number of live WebGL contexts
(~16 in Chrome), so a world that is garbage-collected without being
disposed leaks one, and a long session eventually stops rendering
altogether. The world must not be used after disposal.

## Game loop

The caller owns a `FrameScheduler` from
[@jolly-pixel/loop](../../../loop/README.md) and passes each `FrameSchedule` to
the world. Use one scheduler per app. `World` reads no clock.

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

`@jolly-pixel/runtime` provides a `GameLoop` that owns the frame source and
scheduler. It calls `tick()` from the renderer's animation loop. Configure
timing on the loop:

```ts
runtime.loop.scheduler.fixedFps = 60;  // simulation rate
runtime.loop.scheduler.maxFps = 144;   // render cap, independent of fixedFps
runtime.loop.timeScale = 0.5;          // slow motion; 0 pauses the simulation
```

#### `tick(schedule)`

`schedule` is the `FrameSchedule` produced for the current frame, and `World`
uses it unchanged because it has no accumulator. Tests and editors can replay
or construct any frame. Returns `true` when the input system asked to exit.

One frame, in order:

1. Calls `sceneManager.beginFrame()`, which snapshots the actor tree and
   starts pending components. The snapshot is reused by every `fixedUpdate`
   and `update` call in the frame.
2. Calls `input.sample()` once.
3. Runs `schedule.steps` fixed steps, each preceded by
   `input.publish("step")`. See [Input](../../../controls/docs/input.md).
4. On a drawn frame, calls `input.publish("frame")`, then
   `sceneManager.update(deltaTime, alpha)`, then
   `renderer.draw(sceneManager.getSource())`.
5. Calls `endFrame()`.

#### `fixedUpdate(deltaTime, stepIndex)`

Runs deterministic logic at a fixed rate, 0 to `maxStepsPerFrame` times per
frame, always with the same delta. `stepIndex` counts the steps within the
current frame, from zero.

Input is published to each step, so a catch-up frame running three steps
reports a press edge to the first step only. A frame that runs no step keeps
its edges pending for the next step, so a press during slow motion or on a
display faster than the step rate is never lost to `fixedUpdate`. While paused, edges
wait for the next step, such as one run by `GameLoop.step()` or the first one
after `resume()`.

#### `update(deltaTime, alpha)`

Runs variable-rate logic once per drawn frame. `alpha` is how far the frame
sits between the last fixed step and the next one, in `[0, 1)`. Pass it to
`Interpolated` from `@jolly-pixel/loop` to draw smoothly between steps. The
engine does not interpolate transforms: a component that moves an actor in
`fixedUpdate` should interpolate it here, or the motion looks choppy on fast
displays and in slow motion. See
[Interpolated](../../../loop/docs/interpolated.md#slow-motion).

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

Before this phase, `World` calls `input.publish("frame")`: the transitions,
typed characters and mouse movement sampled since the previous drawn frame.
Variable-rate components therefore see each edge once even when the current
frame ran several fixed steps or none.

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

Code that must keep running at normal speed while the game slows down or
pauses reads `unscaledDelta`: cameras, UI motion, debug tools, and tweens of
`timeScale` itself. [Camera3DControls](../components/camera-3d-controls.md)
and [OrbitFlyCamera](../components/orbit-fly-camera.md) move by it.

```ts
const { time } = this.actor.world;

if (time.fixedElapsed - this.lastShot >= 2) {
  this.lastShot = time.fixedElapsed;
}
```

A tick on a stopped world does not advance the time.

#### `endFrame(): boolean`

Called once at the end of each animation frame:

1. Calls `sceneManager.endFrame()`, which destroys pending components
   and actors.
2. If the input system signals an exit, clears the renderer and
   returns `true`. Otherwise returns `false`.

### `render()`

Delegates to `renderer.draw(scene)`, which resizes if needed, clears
the frame buffer, and renders the scene through all active
cameras.

## Rendering on demand

A host can stop ticking while nothing changes, as the runtime's
`renderOnDemand` option does. The world tells it when frames are needed:

```ts
type WorldKeepAlive = () => boolean;

invalidate(): void;
keepAlive(predicate: WorldKeepAlive): () => void;
get animating(): boolean;
```

`invalidate()` emits `invalidate`. Call it after changing what is drawn from
outside a frame, such as from a network or timer callback. `keepAlive()` adds
a predicate read after every frame; frames continue while one returns `true`,
so an animation or a damped motion can settle. It invalidates once and returns
a function removing the predicate. `animating` is `true` while any predicate
returns `true`.

```ts
const release = this.actor.world.keepAlive(() => this.fading);
this.addTeardown(release);
```

A host that ticks every frame ignores both, so components can call them
unconditionally.

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
- [Renderer](renderer.md): rendering pipeline
- [Logger](logger.md): `world.logger`, namespaces and steps
- [Input](../../../controls/docs/input.md): input handling
- [Actor](../actor/actor.md): the engine's core entity
