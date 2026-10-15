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
| `maxStepsPerFrame` | `5` | integer `>= 1` | More steps than this is a panic. Multiplied by `timeScale` above `1`, rounded up. |
| `timeScale` | `1` | `>= 0` | Simulation speed. `0` pauses. |
| `snapTolerance` | `0` | finite, `>= 0` | Largest gap, in ms, between a frame delta and a whole number of refresh periods that still [snaps](#frame-pacing). `0` disables snapping. |

Out-of-range values throw `RangeError`, in the constructor and on assignment.

## Methods

### `advance(now: number): FrameSchedule`

Schedules the work since the previous timestamp. Call it once per frame.

- The first call after construction or `reset()` has a zero delta, runs no
  step, and renders. It starts the accumulator at half a step, so its `alpha`
  is `0.5`.
- A timestamp older than the previous one counts as a zero delta.

### `reset(): void`

Clears all accumulated state, counters included.

### `skipGap(): void`

Forgets the previous timestamp only. The next `advance()` has a zero delta;
`time`, `elapsed` and the accumulator are kept.

Call it when frames resume after an intentional pause, so the pause is not
replayed as a burst of steps. `GameLoop` does this when it wakes up.

### `queueSteps(count: number): void`

Adds `count` fixed steps to the next `advance()`, on top of the steps its
delta pays for. That frame renders, and its `frameDelta`, `time` and `elapsed`
grow by `count * fixedDelta`. Queued steps work at `timeScale: 0`, do not
count toward `maxStepsPerFrame` and leave the accumulator alone. `reset()`
drops them.

Throws `RangeError` unless `count` is an integer `>= 1`.

## FrameSchedule

`advance()` returns a fresh object every frame.

| Field | Meaning |
| --- | --- |
| `rawDelta` | Time since the previous frame, before clamping and `timeScale`. |
| `unscaledDelta` | Same delta after clamping or snapping, before `timeScale`. Keeps flowing while paused. |
| `frameDelta` | Same delta after clamping or snapping, and `timeScale`. |
| `renderDelta` | `frameDelta` summed since the previous rendered frame, this one included. What `update` should advance by. |
| `unscaledRenderDelta` | `unscaledDelta` summed the same way. |
| `fixedDelta` | `1000 / fixedFps`. |
| `steps` | Fixed steps to run now. |
| `alpha` | Leftover time as a fraction of a step, in `[0, 1)`. Pass it to [`Interpolated.at()`](./interpolated.md). |
| `render` | `false` when `maxFps` skips this frame. |
| `clamped` | `rawDelta` was above `maxFrameDelta`. |
| `snapped` | `unscaledDelta` was snapped to whole refresh periods. |
| `panicked` | More steps were due than the step budget allows; the time beyond half a step was dropped. |
| `droppedMs` | Time dropped by the panic. `0` otherwise. |

`clamped` and `panicked` can both be `true` on the same frame.

## Properties

The six options are readable and writable properties.

- Setting `fixedFps` keeps the accumulator.
- Setting `maxFps` restarts render pacing.
- Renders land on the frame nearest to each `1000 / maxFps` tick, so a cap
  equal to the display rate draws every frame despite timestamp jitter.

Read-only counters, all reset by `reset()`:

| Property | Meaning |
| --- | --- |
| `fixedDelta` | `1000 / fixedFps`. |
| `accumulator` | Time not yet consumed by a step. |
| `time` | Time consumed by fixed steps. |
| `elapsed` | Clamped or snapped, then scaled time received. The sum of every `frameDelta`. |
| `droppedTime` | Total time dropped by panics. |
| `phaseShift` | Time added to or removed from the accumulator to [center its remainder](#frame-pacing). |
| `refreshPeriod` | Measured display frame period in ms, or `null` before 8 frames. |
| `frameCount` | Calls to `advance()`. |

`elapsed + phaseShift` equals `time + accumulator + droppedTime`, give or take
float error.

## Frame pacing

On a steady 60 Hz display with 60 steps per second, every frame should run
exactly one step. Timestamp jitter breaks that when the leftover time sits near
a step boundary. Frames then alternate between 0 and 2 steps, and pixel-snapped
motion stutters even though the frame rate is steady.

- The scheduler starts the accumulator at half a step, the furthest point from
  both boundaries. A panic also keeps half a step. With no other change, a
  60 Hz display with ±0.75 ms of jitter runs one step on every frame.
- `refreshPeriod` measures the display period from recent deltas. A missed
  refresh counts as two periods, so dropped frames do not skew it.
- With `snapTolerance` above `0`, a delta within that many ms of a whole
  number of periods is replaced by that number of periods. When the period is
  within 1% of a whole multiple or divisor of `fixedDelta` (60, 120 or
  240 Hz for 60 steps per second, 59.94 Hz included), the delta snaps to that
  exact multiple, and the remainder is moved back to the middle of its range.
  Game time then follows the frame count instead of the clock: one step per
  frame at 60 Hz, one step every other frame at 120 Hz, two steps after a
  missed refresh.
- Set `snapTolerance` to about twice the timestamp jitter. Timestamps jittering
  by ±0.75 ms produce deltas jittering by ±1.5 ms, so `2` fits.
- Displays such as 144 Hz do not fit 60 steps per second. Snapping still removes
  their jitter, but steps keep alternating unevenly.
- A locked 59.94 Hz display runs game time 0.1% slower than the clock.

[`FrameRateGovernor`](./framerategovernor.md) halves the render rate when
frames keep missing their refresh.

## Gotchas

> [!WARNING]
> Keep calling `advance()` on frames you won't draw. A [frame source](./framesource.md)
> that skips frames to cap the frame rate makes steps arrive in bursts. Use
> `maxFps` instead.

- `maxFps` paces on real time, ignoring `timeScale`. A paused simulation keeps
  rendering at the cap.
