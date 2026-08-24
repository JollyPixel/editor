# Benchmarks

Raw-performance benchmarks for the two things this package does every frame:
decide a schedule, and dispatch the callbacks that schedule implies.

- **scheduler** — `FrameScheduler#advance()` across the shapes the step loop
  takes: a steady frame, a step-less frame, a catch-up frame, a panicking
  frame, and a render-capped frame.
- **primitives** — `GameLoop` dispatch, `Interpolated#at()` / `push()`,
  `FrameBudget#expired`.

Everything runs headless: `ManualClock` and `ManualFrameSource` mean no DOM and
no real time. Built on [tinybench](https://github.com/tinylibs/tinybench).

## Running

```bash
npm run bench -w @jolly-pixel/loop      # every suite
node bench/scheduler.bench.ts           # a single suite
BENCH_FORMAT=json npm run bench -w @jolly-pixel/loop
BENCH_TASK=steady node bench/scheduler.bench.ts
```

`BENCH_TIME_MS`, `BENCH_ITERATIONS`, `BENCH_WARMUP_TIME_MS` and
`BENCH_WARMUP_ITERATIONS` raise the sampling budget for regression runs.
`BENCH_FORMAT=json` emits one JSON object per suite for storage in CI.

## Why tasks are batched

Every call here takes tens of nanoseconds, below tinybench's own per-iteration
overhead — measured directly, every task pins to the same ceiling and real
differences vanish. Each task therefore performs `BENCH_BATCH` calls (default
100) per iteration, and the harness divides back out into the **ns/op** column.
That column is the one to compare; `mean (ms)` is per batch.

Tasks whose result is otherwise unused accumulate into a sink, because V8
happily deletes a call nobody reads. Adding the sink doubled the measured cost
of `Interpolated#at()` and `FrameBudget#expired`, which is how much of the
first reading was nothing at all.

## Recorded numbers

Node v24.18.0, V8 13.6.233.17, win32 x64, Intel Core Ultra 9 285HX.

### `FrameScheduler#advance`

| task | ns/op |
| --- | --- |
| steady 60Hz — one step per frame | 16.8 |
| 144Hz against 60Hz — mostly step-less frames | 18.0 |
| overloaded — budget hit, remainder dropped | 15.8 |
| catch-up — 12 steps per frame | 15.5 |
| render capped — 60fps cap on a 144Hz source | 41.2 |

### primitives

| task | ns/op |
| --- | --- |
| GameLoop frame — one step, dispatched | 38.1 |
| Interpolated#at() — between the endpoints | 13.6 |
| Interpolated#push() | 6.8 |
| FrameBudget#expired | 13.5 |

## What the numbers say

**The per-frame `FrameSchedule` allocation is not worth optimising away.**
SPEC section 2 asserted this; here it is measured. A steady frame costs ~17ns,
which at 144fps is 2.4µs of scheduling per second of gameplay — about
0.0002% of the frame budget. `advanceInto(target)` stays a non-breaking
addition nobody needs yet, and the schedule stays a fresh object the
visualization UI can retain.

**Step count does not change the cost of deciding.** The catch-up frame runs
twelve steps for the same ~16ns as the steady frame's one, because the step
loop is arithmetic (`Math.floor`, one multiply) rather than iteration. The
twelve steps cost whatever the *host* pays to run them; the scheduler charges
nothing for counting them.

**Render capping costs more than everything else combined** — 41ns against 17,
from the float modulo in the render accumulator. It is still noise (6µs per
second at 144fps), and the even pacing it buys is the point of SPEC section 4,
but it is the one line here that would be worth revisiting if `advance()` ever
showed up in a profile.

**`GameLoop` dispatch roughly doubles a bare `advance()`** — 38ns against 17,
for the source hop, the event checks and three optional callbacks. That is the
price of the facade, and the reason SPEC section 1 lets `World` skip it and
call `advance()` directly.
