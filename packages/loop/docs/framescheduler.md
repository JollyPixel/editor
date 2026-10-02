# FrameScheduler

Turns frame timestamps into fixed simulation steps plus a render decision.

**Use it when** you already own the frame pump. Otherwise use
[`GameLoop`](./gameloop.md), which wraps it.

```ts
import { FrameScheduler } from "@jolly-pixel/loop";

const scheduler = new FrameScheduler({
  fixedFps: 60
});

function tick(
  now: number
) {
  const schedule = scheduler.advance(now);

  for (let stepIndex = 0; stepIndex < schedule.steps; stepIndex++) {
    world.step(
      schedule.fixedDelta / 1000,
      stepIndex
    );
  }
  if (schedule.render) {
    renderer.draw(schedule.alpha);
  }
}
```

All times are **milliseconds**.

## Options

```ts
new FrameScheduler(options?: FrameSchedulerOptions);
```

| Option | Default | Valid range | What it does |
| --- | --- | --- | --- |
| `fixedFps` | `60` | `> 0` | Fixed steps per second. |
| `maxFps` | `Infinity` | `> 0`, `Infinity` allowed | Render cap. Steps still run on capped frames. |
| `maxFrameDelta` | `250` | `> 0` | Longer frame deltas are clamped to this. |
| `maxStepsPerFrame` | `5` | integer `>= 1` | More steps than this is a panic. |
| `timeScale` | `1` | `>= 0` | Simulation speed. `0` pauses. |

Out-of-range values throw `RangeError`, in the constructor and on assignment.

## Methods

### `advance(now: number): FrameSchedule`

Schedules the work since the previous timestamp. Call it once per frame.

- The first call after construction or `reset()` has a zero delta, runs no
  step, and renders.
- A timestamp older than the previous one counts as a zero delta.

### `reset(): void`

Clears all accumulated state, counters included.

### `skipGap(): void`

Forgets the previous timestamp only. The next `advance()` has a zero delta;
`time`, `elapsed` and the accumulator are kept.

Call it when frames resume after an intentional pause, so the pause is not
replayed as a burst of steps. `GameLoop` does this when it wakes up.

## FrameSchedule

`advance()` returns a fresh object every frame.

| Field | Meaning |
| --- | --- |
| `rawDelta` | Time since the previous frame, before clamping and `timeScale`. |
| `frameDelta` | Same delta after clamping and `timeScale`. |
| `fixedDelta` | `1000 / fixedFps`. |
| `steps` | Fixed steps to run now. |
| `alpha` | Leftover time as a fraction of a step, in `[0, 1)`. Pass it to [`Interpolated.at()`](./interpolated.md). |
| `render` | `false` when `maxFps` skips this frame. |
| `clamped` | `rawDelta` was above `maxFrameDelta`. |
| `panicked` | More than `maxStepsPerFrame` steps were due; the extra time was dropped. |
| `droppedMs` | Time dropped by the panic. `0` otherwise. |

`clamped` and `panicked` can both be `true` on the same frame.

## Properties

The five options are readable and writable properties.

- Setting `fixedFps` keeps the accumulator.
- Setting `maxFps` restarts render pacing.

Read-only counters, all reset by `reset()`:

| Property | Meaning |
| --- | --- |
| `fixedDelta` | `1000 / fixedFps`. |
| `accumulator` | Time not yet consumed by a step. |
| `time` | Time consumed by fixed steps. |
| `elapsed` | Clamped and scaled time received. |
| `droppedTime` | Total time dropped by panics. |
| `frameCount` | Calls to `advance()`. |

`elapsed` equals `time + accumulator + droppedTime`, give or take float error.

## Gotchas

> [!WARNING]
> Keep calling `advance()` on frames you won't draw. A [frame source](./framesource.md)
> that skips frames to cap the frame rate makes steps arrive in bursts. Use
> `maxFps` instead.

- `maxFps` paces on real time, ignoring `timeScale`. A paused simulation keeps
  rendering at the cap.
