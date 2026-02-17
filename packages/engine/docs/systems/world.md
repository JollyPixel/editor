## World

The `World` is the central orchestrator of the engine. It
wires together the [SceneManager](scene-manager.md),
[Renderer](renderer.md), [Input](../controls/input.md),
and [Audio](../audio/audio.md) systems and drives the main
**connect → update → render** loop.

Every project creates exactly one `World`. It is passed to
every [Actor](../actor/actor.md) at construction time and is
available throughout the component tree via `actor.world`.

### Creating a game instance

```ts
import {
  SceneEngine,
  ThreeRenderer,
  World
} from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const sceneManager = new SceneManager();
const renderer = new ThreeRenderer(canvas, { scene: sceneManager });

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

### Loading manager

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

### Connect and disconnect

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

### Game loop

The game loop is driven by a
[FixedTimeStep](../internals/fixed-time-step.md) which separates
deterministic logic from rendering:

```ts
const fixedTimeStep = new FixedTimeStep();
fixedTimeStep.start();

function loop() {
  game.beginFrame();
  fixedTimeStep.tick({
    fixedUpdate: (fixedDelta) => {
      game.fixedUpdate(fixedDelta / 1000);
    },
    update: (_interpolation, delta) => {
      game.update(delta / 1000);
      game.render();
    }
  });
  const exited = game.endFrame();
  if (exited) { /* stop loop */ }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

#### `beginFrame()`

Called once at the start of each animation frame:

1. Updates the [Input](../controls/input.md) system.
2. Calls `sceneManager.beginFrame()` — snapshots the actor tree
   and starts pending components. The snapshot is reused by all
   `fixedUpdate` and `update` calls within the same frame.

#### `fixedUpdate(deltaTime)`

Runs deterministic logic at a fixed rate (0 to N times per frame):

1. Calls `sceneManager.fixedUpdate(deltaTime)` — runs
   `actor.fixedUpdate(deltaTime)` on each cached actor.

#### `update(deltaTime)`

Runs variable-rate logic once per rendered frame:

1. Calls `sceneManager.update(deltaTime)` — runs
   `actor.update(deltaTime)` on each cached actor.

#### `endFrame(): boolean`

Called once at the end of each animation frame:

1. Calls `sceneManager.endFrame()` — destroys pending components
   and actors.
2. If the input system signals an exit, clears the renderer and
   returns `true`. Otherwise returns `false`.

#### `render()`

Delegates to `renderer.draw()`, which resizes if needed, clears
the frame buffer, and renders the scene through all active
cameras.

### Accessing subsystems

All subsystems are available as public properties, making them
accessible from any actor or component:

```ts
// From inside a Behavior
const { input, sceneManager, audio, renderer } = this.actor.world;

if (input.isKeyDown("Space")) {
  audio.play("jump");
}
```

### See also

- [SceneManager](scene-manager.md) — actor tree, lifecycle, and destruction
- [Renderer](renderer.md) — rendering pipeline
- [Input](../controls/input.md) — input handling
- [Actor](../actor/actor.md) — the engine's core entity
