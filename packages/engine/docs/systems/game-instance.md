## GameInstance

The `GameInstance` is the central orchestrator of the engine. It
wires together the [Scene](scene.md),
[Renderer](renderer.md), [Input](../controls/input.md),
and [Audio](../audio/audio.md) systems and drives the main
**connect → update → render** loop.

Every project creates exactly one `GameInstance`. It is passed to
every [Actor](../actor/actor.md) at construction time and is
available throughout the component tree via `actor.gameInstance`.

### Creating a game instance

```ts
import {
  SceneEngine,
  ThreeRenderer,
  GameInstance
} from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const scene = new SceneEngine();
const renderer = new ThreeRenderer(canvas, { scene });

const game = new GameInstance(renderer, { scene });
```

The constructor accepts a [Renderer](renderer.md) and a
`GameInstanceOptions` object:

```ts
interface GameInstanceOptions {
  /** The scene that manages actors and components. */
  scene: Scene;
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
`actor.gameInstance.loadingManager`.

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

The game loop is driven externally (typically via
`requestAnimationFrame`). Each tick calls `update` then `render`:

```ts
function loop(time: number) {
  const deltaTime = /* compute delta */;

  const exited = game.update(deltaTime);
  if (!exited) {
    game.render();
    requestAnimationFrame(loop);
  }
}

requestAnimationFrame(loop);
```

#### `update(deltaTime): boolean`

Performs a single logical frame:

1. Updates the [Input](../controls/input.md) system.
2. Calls `scene.update(deltaTime)` — starts new components,
   updates actors, and cleans up destroyed entities
   (see [Scene — Update loop](scene.md#update-loop)).
3. If the input system signals an exit, clears the renderer and
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
const { input, scene, audio, renderer } = this.actor.gameInstance;

if (input.isKeyDown("Space")) {
  audio.play("jump");
}
```

### See also

- [Scene](scene.md) — actor tree, lifecycle, and destruction
- [Renderer](renderer.md) — rendering pipeline
- [Input](../controls/input.md) — input handling
- [Actor](../actor/actor.md) — the engine's core entity
