## FixedTimeStep

`FixedTimeStep` decouples the game's **logical update rate** from
the display's frame rate. Instead of updating once per rendered
frame (which varies with hardware and browser load), it
accumulates elapsed time and runs a fixed number of updates at a
constant interval. This ensures deterministic, reproducible
physics and gameplay regardless of rendering performance.

The implementation guards against the
["doom spiral"](http://blogs.msdn.com/b/shawnhar/archive/2011/03/25/technical-term-that-should-exist-quot-black-pit-of-despair-quot.aspx)
— a situation where each tick takes longer than the previous one —
by capping accumulated time to at most 5 update intervals.

### How it works

```
requestAnimationFrame
  │
  ├─ clock.update()           ← advance the timer
  │
  ├─ accumulatedTime += dt    ← add frame delta
  │
  └─ while accumulatedTime >= updateInterval
       ├─ callback(deltaTime) ← fixed-step game update
       └─ accumulatedTime -= updateInterval
```

On every browser frame the caller feeds the accumulated time into
`tick()`. The method consumes as many fixed-size intervals as
possible, calls the update callback for each one, and returns how
much time is left over for the next frame.

### Usage

```ts
import { FixedTimeStep } from "@jolly-pixel/engine";

const fixedTimeStep = new FixedTimeStep();
fixedTimeStep.setFps(60);

let accumulatedTime = 0;

function loop() {
  const { updates, timeLeft } = fixedTimeStep.tick(
    accumulatedTime,
    (deltaTime) => {
      // Run one fixed-step update
      const exited = game.update(deltaTime);

      // Returning true stops processing remaining steps
      return exited;
    }
  );

  accumulatedTime = timeLeft;
  game.render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

### TimerAdapter

`FixedTimeStep` relies on a `TimerAdapter` for time measurement.
By default it uses Three.js's `THREE.Timer`, but any object that
satisfies the interface can be injected (useful for testing with
deterministic time):

```ts
interface TimerAdapter {
  /** Advance the internal clock. Called once per tick. */
  update: () => void;
  /** Return the elapsed time since the last update (in ms). */
  getDelta: () => number;
}
```

```ts
// Custom clock for tests
const mockClock: TimerAdapter = {
  update: () => {},
  getDelta: () => 16.67
};

const fixedTimeStep = new FixedTimeStep(mockClock);
```

### Configuring the frame rate

The target frame rate defaults to **60 FPS** and can be changed
with `setFps`. Values are clamped between `1` and
`FixedTimeStep.MaxFramesPerSecond` (60):

```ts
fixedTimeStep.setFps(30);
```

The update interval is derived as `1000 / framesPerSecond`
(in milliseconds).

### Tick result

`tick()` returns an object describing what happened during the
call:

```ts
interface TickResult {
  /** Number of fixed updates that were executed. */
  updates: number;
  /** Remaining accumulated time to carry over to the next frame. */
  timeLeft: number;
}
```

- **`updates === 0`** — the frame was too short for a full step;
  the leftover time is carried over.
- **`updates > 0`** — the callback ran that many times, each with
  a consistent `deltaTime`.
- **Early exit** — if the callback returns `true`, processing
  stops immediately and the remaining time is returned.

### Doom spiral protection

If the browser stalls (e.g. tab switch, debugger breakpoint), the
accumulated time can grow very large. Without a cap, the engine
would try to catch up with dozens of updates in a single frame,
making the problem worse. `FixedTimeStep` limits catch-up to at
most **5 intervals**, discarding excess time.
