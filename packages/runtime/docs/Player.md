# Player

Main runtime class. Wraps a Three.js renderer, a game instance, and the
update/render loop. Manages the full lifecycle: construction, starting,
stopping, and frame-rate control.

- **start()**: Connects the game instance and begins the render loop via `setAnimationLoop`.
- **stop()**: Disconnects the game instance and removes the animation loop.
- **setFps(fps)**: Clamps the target FPS between `1` and `60`. No-op if `fps` is falsy.

```ts
interface PlayerOptions {
  /**
   * When true, a stats.js panel is appended to the document to show FPS.
   * @default false
   */
  includePerformanceStats?: boolean;
}

class Player {
  gameInstance: Systems.GameInstance;
  canvas: HTMLCanvasElement;
  stats?: Stats;
  clock: THREE.Clock;
  manager: THREE.LoadingManager;
  framesPerSecond: number;

  get running(): boolean;

  constructor(canvas: HTMLCanvasElement, options?: PlayerOptions);

  start(): void;
  stop(): void;
  setFps(framesPerSecond: number | undefined): void;
}
```

> [!NOTE]
> The constructor throws an `Error` if `canvas` is falsy.

## Usage

```ts
import { Player, loadPlayer } from "@jolly-pixel/runtime";

const canvas = document.querySelector("canvas")!;
const player = new Player(canvas, {
  includePerformanceStats: true
});

const { gameInstance } = player;
// Work with the gameInstance

loadPlayer(player)
  .catch(console.error);
```
