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
}

new GameLoop(options?: GameLoopOptions);
```

Scheduler options (`fixedFps`, `maxFps`, `maxFrameDelta`, `maxStepsPerFrame`,
`timeScale`) are forwarded to the scheduler it builds.

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
};
```

`start` is emitted before the source can deliver a frame. `pause` carries the
new state for both pause and resume operations. `clamp` includes the uncapped
`rawDelta` and the consumed `frameDelta`; `panic` includes the step count and
dropped simulation time.

## Properties

| Property | Description |
| --- | --- |
| `scheduler` | Read-only `FrameScheduler` used by the loop. |
| `source` | Read-only `FrameSource` used by the loop. |
| `running` | Whether the source has been started by the loop. |
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
