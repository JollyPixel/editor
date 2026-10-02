# GameLoop

`GameLoop` connects a [`FrameSource`](./framesource.md) and
[`FrameScheduler`](./framescheduler.md) to host callbacks. It extends `Emitter`
from `@openally/emitt`.

```ts
import { GameLoop } from "@jolly-pixel/loop";

const loop = new GameLoop({ fixedFps: 60, maxFps: 144 });

loop.on("panic", ({ droppedMs }) => {
  console.warn(`dropped ${droppedMs}ms`);
});

loop.start({
  fixedUpdate: (fixedDeltaMs) => world.step(fixedDeltaMs / 1000),
  update: (frameDeltaMs, alpha) => renderer.draw(alpha)
});
```

## Constructor

### `new GameLoop(options)`

```ts
export interface GameLoopOptions extends FrameSchedulerOptions {
  // Defaults to a RafFrameSource
  source?: FrameSource;
  // Defaults to () => true: the loop never sleeps
  keepAlive?: () => boolean;
  // Defaults to 2
  trailingRenders?: number;
}

new GameLoop(options?: GameLoopOptions);
```

Scheduler options (`fixedFps`, `maxFps`, `maxFrameDelta`, `maxStepsPerFrame`,
`timeScale`) are forwarded to the scheduler it builds. `keepAlive` and
`trailingRenders` control [rendering on demand](#rendering-on-demand). The
constructor throws `RangeError` when `trailingRenders` is not an integer
`>= 0`.

## Callbacks

```ts
export interface GameLoopCallbacks {
  // Runs schedule.steps times per frame, always with the same delta
  fixedUpdate?: (fixedDeltaMs: number, stepIndex: number) => void;
  // Runs once per drawn frame, after the fixed steps
  update?: (frameDeltaMs: number, alpha: number) => void;
  // Runs once per frame, drawn or not, before any step
  frame?: (schedule: FrameSchedule, now: number) => void;
}
```

Deltas are **milliseconds**; hosts working in seconds divide by 1000.

`update` is skipped when `schedule.render` is `false`. `frame` still runs and
receives the full schedule before fixed steps. `stepIndex` starts at `0` on
each frame.

## Events

```ts
export type GameLoopEvents = {
  start: () => void;
  stop: () => void;
  pause: (payload: { paused: boolean; }) => void;
  panic: (payload: { droppedMs: number; steps: number; }) => void;
  clamp: (payload: { rawDelta: number; frameDelta: number; }) => void;
  sleep: () => void;
  wake: () => void;
};
```

`start` is emitted before the source can deliver a frame. `pause` carries the
new state for both pause and resume operations. `clamp` includes the uncapped
`rawDelta` and the consumed `frameDelta`; `panic` includes the step count and
dropped simulation time. `sleep` and `wake` mark the loop going idle and
resuming; neither is emitted by `start()` or `stop()`.

## Properties

| Property | Description |
| --- | --- |
| `scheduler` | Read-only `FrameScheduler` used by the loop. |
| `source` | Read-only `FrameSource` used by the loop. |
| `running` | Whether the source has been started by the loop. |
| `sleeping` | Whether the loop is running but idle, with its source stopped. |
| `paused` | Whether simulation time is paused. |
| `timeScale` | Requested simulation scale, including while paused. |

Configure scheduling through `loop.scheduler`. Set the time scale through
`loop.timeScale`, because the loop temporarily sets the scheduler's scale to
`0` while paused.

## API

`start(callbacks?: GameLoopCallbacks): this` resets the scheduler and starts
the source. Starting a running loop throws `Error`.

`stop(): this` stops the source and clears the paused state. It is a no-op when
the loop is stopped.

`pause(): this` sets the scheduler time scale to `0`; `resume(): this` restores
the requested `loop.timeScale`. Both are idempotent.

Callbacks are retained across a stop/start cycle: omit them and the loop
restarts with the ones already registered, pass them to replace the set.

Frames continue while paused. They have `frameDelta: 0`, run no fixed steps,
and may still render. Paused time is not accumulated for replay on resume.

`invalidate(): void` asks for another rendered frame and wakes a sleeping
loop. On a stopped loop it does nothing, since `start()` renders anyway.

## Rendering on demand

A loop given a `keepAlive` predicate stops its source while nothing asks for
frames, for a view that only changes on input or data. It stays `running`, so
`suspendWhenHidden` keeps working.

```ts
import { AnimationLoopFrameSource, GameLoop } from "@jolly-pixel/loop";

const loop = new GameLoop({
  source: new AnimationLoopFrameSource(renderer),
  keepAlive: () => camera.moving
});

canvas.addEventListener("pointermove", () => loop.invalidate());
```

After each frame the loop sleeps once it owes no more rendered frames.
`start()` and `invalidate()` owe the next rendered frame plus
`trailingRenders`, and so does every frame after which `keepAlive` returns
`true`. Only rendered frames pay the debt, so a `maxFps` cap never swallows a
requested frame, and a frame that calls `invalidate()` always gets at least one
rendered successor. Without `keepAlive` the loop never sleeps.

Waking calls [`scheduler.skipGap()`](./framescheduler.md#api) before restarting
the source, so the first frame after a sleep reports a zero delta instead of
the idle time.

## suspendWhenHidden

```ts
suspendWhenHidden(loop: GameLoop, target: Element, signal: AbortSignal): void;
```

Stops a running loop while `target` is outside the viewport, or inside a hidden
frame, and starts it again once `target` shows. The restart resets the
scheduler, so the first frame back has no catch-up delta. Visibility comes from
an `IntersectionObserver`, which must exist on `globalThis`.

```ts
import { GameLoop, suspendWhenHidden } from "@jolly-pixel/loop";

const session = new AbortController();
loop.start({ update });
suspendWhenHidden(loop, canvas, session.signal);

// later, when the host stops the loop for good
loop.stop();
session.abort();
```

The loop is only restarted if visibility stopped it. A loop the owner started
again while hidden keeps running. Abort `signal` when the owner stops the loop:
a `stop()` while the loop is already suspended is a no-op the helper cannot
see, so the loop would start again once `target` shows.
