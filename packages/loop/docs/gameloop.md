# GameLoop

Runs your callbacks on every frame: fixed simulation steps, then a render.

**Use it when** you want a ready-made loop. It owns a
[`FrameSource`](./framesource.md) and a [`FrameScheduler`](./framescheduler.md),
and extends `Emitter`.

```ts
import { GameLoop } from "@jolly-pixel/loop";

const loop = new GameLoop({
  fixedFps: 60,
  maxFps: 144
});

loop.on("panic", ({ droppedMs }) => {
  console.warn(`dropped ${droppedMs}ms`);
});

loop.start({
  fixedUpdate: (fixedDeltaMs) => {
    return world.step(fixedDeltaMs / 1000);
  },
  update: (frameDeltaMs, alpha) => {
    return renderer.draw(alpha);
  }
});
```

## Options

```ts
new GameLoop(options?: GameLoopOptions);
```

Takes every [`FrameScheduler` option](./framescheduler.md#options), plus:

| Option | Default | What it does |
| --- | --- | --- |
| `source` | `new RequestAnimationFrameSource()` | Where frames come from. |
| `keepAlive` | `() => true` | Return `false` to let the loop sleep. See [Rendering on demand](#rendering-on-demand). |
| `trailingRenders` | `2` | Extra frames to render before sleeping. Integer `>= 0`, else `RangeError`. |

## Callbacks

Passed to `start()`. All optional. Deltas are **milliseconds**.

| Callback | When it runs |
| --- | --- |
| `frame(schedule, now)` | Every frame, first. Gets the full [`FrameSchedule`](./framescheduler.md#frameschedule). |
| `fixedUpdate(fixedDeltaMs, stepIndex)` | `schedule.steps` times. `stepIndex` restarts at `0` each frame. |
| `update(frameDeltaMs, alpha)` | Last, only when `schedule.render` is `true`. |

## Methods

### `start(callbacks?): this`

Resets the scheduler and starts the source. Throws `Error` if already running.

Callbacks stick across `stop()`/`start()`. Omit them to reuse the last set.

### `stop(): this`

Stops the source and clears `paused`. Does nothing when already stopped.

### `pause(): this` / `resume(): this`

Freeze and unfreeze simulation time. Both are safe to call twice.

While paused, frames keep coming with `frameDelta: 0` and no fixed steps, and
`update` still runs. Paused time is not replayed on resume.

### `invalidate(): void`

Asks for another rendered frame and wakes a sleeping loop. Does nothing on a
stopped loop.

## Properties

| Property | Meaning |
| --- | --- |
| `scheduler` | The `FrameScheduler`. Change scheduling options here. |
| `source` | The `FrameSource`. |
| `running` | `start()` was called and `stop()` was not. Stays `true` while sleeping. |
| `sleeping` | Running, but the source is stopped until something calls `invalidate()`. |
| `paused` | Simulation time is frozen. |
| `timeScale` | Simulation speed. Read and write. |

> [!IMPORTANT]
> Set the speed with `loop.timeScale`, not `loop.scheduler.timeScale`. Pausing
> writes `0` to the scheduler and resuming writes `loop.timeScale` back.

## Events

| Event | Payload | Emitted when |
| --- | --- | --- |
| `start` | none | `start()` runs, before the first frame. |
| `stop` | none | `stop()` stops a running loop. |
| `pause` | `{ paused }` | `pause()` (`true`) or `resume()` (`false`) changes state. |
| `clamp` | `{ rawDelta, frameDelta }` | A frame delta was above `maxFrameDelta`. |
| `panic` | `{ droppedMs, steps }` | A frame hit `maxStepsPerFrame` and dropped time. |
| `sleep` | none | The loop goes idle. |
| `wake` | none | `invalidate()` wakes it. |

`clamp` and `panic` fire before the `frame` callback.

## Rendering on demand

Give the loop a `keepAlive` predicate and it stops its source while nothing
needs a frame. Good for views that only change on input.

```ts
import {
  AnimationLoopFrameSource,
  GameLoop
} from "@jolly-pixel/loop";

const loop = new GameLoop({
  source: new AnimationLoopFrameSource(renderer),
  keepAlive: () => camera.moving
});

canvas.addEventListener(
  "pointermove",
  () => loop.invalidate()
);
```

- `start()`, `invalidate()`, and any frame where `keepAlive()` returns `true`
  queue `1 + trailingRenders` rendered frames.
- Once they are drawn, the loop sleeps.
- Frames skipped by `maxFps` don't count, so a cap never eats a requested frame.
- On wake, the idle time is skipped: the first frame has a zero delta.

The loop stays `running` while asleep, so
[`suspendWhenHidden`](./suspendwhenhidden.md) still works.
