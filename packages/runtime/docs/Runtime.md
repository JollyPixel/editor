# Runtime

Main runtime class. Wraps a Three.js renderer, a game instance, and the
update/render loop. Manages the full lifecycle: construction, starting,
stopping, and frame-rate control.

- **start()**: Connects the game instance and begins the render loop via `setAnimationLoop`.
- **stop()**: Disconnects the game instance and removes the animation loop.
- **setFps(fps)**: Clamps the target FPS between `1` and `60`. No-op if `fps` is falsy.

```ts
interface RuntimeOptions<
  TContext = Systems.GameInstanceDefaultContext
> {
  /**
   * @default false
   * Whether to include performance statistics (eg: FPS, memory usage).
   */
  includePerformanceStats?: boolean;
  /**
   * Optional context object passed to the GameInstance.
   */
  context?: TContext;
  /**
   * Optional global audio object passed to the GameInstance.
   * If not provided, a default audio context will be created.
   */
  audio?: GlobalAudio;
}

class Runtime<
  TContext = GameInstanceDefaultContext
> {
  gameInstance: Systems.GameInstance<THREE.WebGLRenderer, TContext>;
  canvas: HTMLCanvasElement;
  stats?: Stats;
  clock: THREE.Clock;
  manager: THREE.LoadingManager;
  framesPerSecond: number;

  get running(): boolean;

  constructor(canvas: HTMLCanvasElement, options?: RuntimeOptions<TContext>);

  start(): void;
  stop(): void;
  setFps(framesPerSecond: number | undefined): void;
}
```

> [!NOTE]
> The constructor throws an `Error` if `canvas` is falsy.

## Usage

```ts
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";

const canvas = document.querySelector("canvas")!;
const runtime = new Runtime(canvas, {
  includePerformanceStats: true
});

const { gameInstance } = runtime;
// Work with the gameInstance

loadRuntime(runtime)
  .catch(console.error);
```

## Type-safe context

The `TContext` generic lets you pass a typed context object to the
underlying `GameInstance`:

```ts
interface MyContext {
  score: number;
  level: string;
}

const runtime = new Runtime<MyContext>(canvas, {
  context: { score: 0, level: "intro" }
});

// runtime.gameInstance.context is typed as MyContext
runtime.gameInstance.context.score; // number
```
