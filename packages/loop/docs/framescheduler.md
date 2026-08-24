# FrameScheduler

Turns wall-clock timestamps into fixed-step schedules. It has no frame driver,
DOM access, callbacks, or event subscribers. Hosts with their own frame pump
can use it without [`GameLoop`](./gameloop.md).

```ts
import { FrameScheduler } from "@jolly-pixel/loop";

const scheduler = new FrameScheduler({ fixedFps: 60 });

function tick(now: number) {
  const schedule = scheduler.advance(now);

  for (let stepIndex = 0; stepIndex < schedule.steps; stepIndex++) {
    world.step(schedule.fixedDelta / 1000, stepIndex);
  }
  if (schedule.render) {
    renderer.draw(schedule.alpha);
  }
}
```

The first call after construction or `reset()` reports a zero delta, runs no
step, and renders. Older timestamps also produce a zero delta.

## Constructor

### `new FrameScheduler(options)`

```ts
export interface FrameSchedulerOptions {
  // Simulation rate, in fixed steps per second
  fixedFps?: number;         // 60
  // Render cap, in frames per second
  maxFps?: number;           // Infinity
  // Upper bound on the raw wall-clock delta, in ms
  maxFrameDelta?: number;    // 250
  // Upper bound on fixed steps per frame
  maxStepsPerFrame?: number; // 5
  // Multiplier applied to the frame delta before accumulating
  timeScale?: number;        // 1
}

new FrameScheduler(options?: FrameSchedulerOptions);
```

`fixedFps` and `maxFrameDelta` must be finite and greater than `0`. `maxFps`
has the same range but also accepts `Infinity`. `maxStepsPerFrame` must be an
integer of at least `1`; `timeScale` must be finite and non-negative. Invalid
constructor options and property assignments throw `RangeError`.

## FrameSchedule

`advance()` returns a new object for each frame.

```ts
export interface FrameSchedule {
  // Wall-clock ms since the previous frame, before clamping and time scale
  rawDelta: number;
  // Wall-clock ms since the previous frame, after clamping and time scale
  frameDelta: number;
  // Constant ms per fixed step. Always 1000 / fixedFps
  fixedDelta: number;
  // Fixed steps the host must run this frame
  steps: number;
  // Accumulator remainder as a fraction of fixedDelta. [0, 1)
  alpha: number;
  // Whether the host should draw this frame (see maxFps)
  render: boolean;
  // Raw delta exceeded maxFrameDelta and was clamped
  clamped: boolean;
  // Step budget was exhausted and the remaining accumulator was discarded
  panicked: boolean;
  // Simulation time discarded by the panic, in ms. 0 unless panicked
  droppedMs: number;
}
```

`clamped` and `panicked` are independent, so both may be true on one schedule.
The non-negative `rawDelta` preserves the uncapped, unscaled stall duration.

## Properties

The option properties are readable and writable. Assigning `maxFps` resets the
render accumulator; assigning `fixedFps` recomputes `fixedDelta` without
clearing the simulation accumulator.

| Read-only property | Description |
| --- | --- |
| `fixedDelta` | Milliseconds per fixed step: `1000 / fixedFps`. |
| `accumulator` | Unconsumed simulation time in milliseconds. |
| `time` | Simulation time consumed by fixed steps since reset. |
| `elapsed` | Clamped and scaled time received since reset. |
| `droppedTime` | Simulation time discarded by panics since reset. |
| `frameCount` | Calls to `advance()` since reset. |

Within floating-point tolerance, `elapsed` equals
`time + accumulator + droppedTime`.

## API

`advance(now: number): FrameSchedule` schedules work since the previous
timestamp. `reset(): void` clears accumulated state and the previous timestamp.

## Render capping

A dedicated render accumulator paces non-divisible rates evenly. Render pacing
uses unscaled wall time, so a paused or slowed simulation can keep drawing.

The [frame source](./framesource.md) must continue delivering timestamps on
frames that are not drawn. Otherwise, elapsed time reaches the simulation
accumulator in bursts.
