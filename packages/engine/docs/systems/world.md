# World

The `World` is the central orchestrator of the engine. It
wires together the [SceneManager](scene-manager.md),
[Renderer](renderer.md), [Input](../controls/input.md),
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
const renderer = await ThreeRenderer.create(canvas, { sceneManager });

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
  /** Abstraction over `window` (useful for testing). @default BrowserWindowAdapter */
  windowAdapter?: WindowAdapter;
  /** Abstraction over global references (useful for testing). @default BrowserGlobalsAdapter */
  globalsAdapter?: GlobalsAdapter;
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

1. Connects the [Input](../controls/input.md) system.
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
2. Runs `schedule.steps` fixed steps, each preceded by an
   [Input](../controls/input.md) update.
3. Updates input once more if the frame ran no step at all.
4. On a drawn frame, calls `sceneManager.update(deltaTime, alpha)` then
   `renderer.draw()`.
5. Calls `endFrame()`.

#### `fixedUpdate(deltaTime, stepIndex)`

Runs deterministic logic at a fixed rate, 0 to `maxStepsPerFrame` times per
frame, always with the same delta. `stepIndex` counts the steps within the
current frame, from zero.

Input is sampled before each step, so a catch-up frame running three steps
reports a press edge to the first step only, and a frame that runs no step
does not diff the edge away before any step has seen it.

#### `update(deltaTime, alpha)`

Runs variable-rate logic once per drawn frame. `alpha` is how far the frame
sits between the last fixed step and the next one, in `[0, 1)`. Pass it to
`Interpolated` from `@jolly-pixel/loop` to draw smoothly between steps.

A frame suppressed by `maxFps` skips `update` and the draw, but still
accumulates time and still runs its fixed steps.

#### `endFrame(): boolean`

Called once at the end of each animation frame:

1. Calls `sceneManager.endFrame()`, which destroys pending components
   and actors.
2. If the input system signals an exit, clears the renderer and
   returns `true`. Otherwise returns `false`.

### `render()`

Delegates to `renderer.draw()`, which resizes if needed, clears
the frame buffer, and renders the scene through all active
cameras.

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
- [Input](../controls/input.md): input handling
- [Actor](../actor/actor.md): the engine's core entity
