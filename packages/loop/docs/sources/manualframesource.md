# ManualFrameSource

[`FrameSource`](../framesource.md) that emits frames only when you ask.

**Use it when** testing or replaying frame timings. No timers involved.

```ts
import {
  GameLoop,
  ManualFrameSource,
} from "@jolly-pixel/loop";

const source = new ManualFrameSource();
const loop = new GameLoop({ source });

loop.start({
  fixedUpdate,
  update,
});
source.step(16);              // one 16ms frame
source.run([100, 16, 16]);    // one hitch, then two normal frames
```

## Constructor

```ts
new ManualFrameSource(clock?: ManualClock);
```

Creates its own [`ManualClock`](../clock.md#manualclock) when none is given.

## Members

| Member | Meaning |
| --- | --- |
| `clock` | Read-only. The `ManualClock` it advances. |
| `running` | Read-only. A callback is registered. |
| `start(callback)` | Registers `callback` and emits one frame right away, at the current clock time. |
| `stop()` | Drops the callback. |
| `step(deltaMs = 0): number` | Advances the clock, emits one frame, returns the new time. Throws `Error` when stopped. |
| `run(tape): void` | Calls `step()` for each delta. Accepts `number[]` or a `FrameTape`. |

## FrameTape

A named list of frame deltas, with the scheduler options it was written for.

```ts
export interface FrameTape {
  name: string;
  description: string;
  options: FrameSchedulerOptions;
  deltas: number[];  // raw frame deltas, in ms
}
```

The package ships no tapes. This repo's tests and demos share theirs in
`fixtures/scenarios.ts`.

## Gotchas

- `start()` emits a frame immediately, and the scheduler's first frame always
  has a zero delta. That frame renders but runs no fixed step. Count it when
  asserting on `update` calls.
