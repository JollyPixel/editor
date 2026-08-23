# Benchmarks

Raw-performance benchmarks for the package's hot paths. Controls run every
frame of every game, so there are three distinct paths worth measuring
separately:

- **tick** — `Input#update()` and each device's `update()`
- **query** — `isDown` / `wasJustPressed` / `position` / `bounds`, called many
  times per frame by behaviors
- **event** — the DOM handlers, which on a high-polling-rate mouse fire far more
  often than frames do

Everything runs headless. The package's adapter seams (`CanvasAdapter`,
`DocumentAdapter`, `NavigatorAdapter`, `WindowAdapter`) mean no DOM is needed;
`_fixtures.ts` provides dispatchable stand-ins for all four.

Built on [tinybench](https://github.com/tinylibs/tinybench).

## Running

```bash
npm run bench -w @jolly-pixel/controls   # every suite
node bench/query.bench.ts                # a single suite
BENCH_FORMAT=json npm run bench -w @jolly-pixel/controls
BENCH_TASK=isDown node bench/query.bench.ts
```

`BENCH_TIME_MS`, `BENCH_ITERATIONS`, `BENCH_WARMUP_TIME_MS` and
`BENCH_WARMUP_ITERATIONS` raise the sampling budget for regression runs.
`BENCH_FORMAT=json` emits one JSON object per suite for storage in CI.

## Why tasks are batched

Most calls here take tens of nanoseconds, which is below tinybench's own
per-iteration overhead — measured directly, every task pins to the same
~100 ns ceiling and real differences vanish. Each task therefore performs
`BENCH_BATCH` calls (default 100) per iteration, and the harness divides back
out into the **ns/op** column. That column is the one to compare; `mean (ms)`
is per batch.

## Suites

| File                    | Covers                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `tick-idle.bench.ts`    | `update()` with nothing held — the common case, and the idle-gate target |
| `tick-active.bench.ts`  | `update()` with keys, buttons, touches and both sticks engaged          |
| `query.bench.ts`        | every query method, plus a composite modeled on `Camera3DControls`      |
| `combination.bench.ts`  | `AllInputs` / `AtLeastOneInput` / `NoneInputs` / `SequenceInputs`       |
| `events.bench.ts`       | mousemove / mousedown / wheel / keydown / touchmove dispatch            |

## Forced layout reads

`events.bench.ts` prints a second table counting `getBoundingClientRect()`
calls per event. Layout cost cannot be reproduced in Node — the call is free
here, whereas in a browser it can flush style and layout for the whole document
— so the **count** is the metric, not the time. `mousemove` should read zero.

## On measuring allocations

There is deliberately no bytes-per-op suite. Three approaches were tried and
none is trustworthy in Node:

- `process.memoryUsage().heapUsed` only settles at collection boundaries, so a
  window with no GC reports almost nothing no matter how much was allocated.
- The `gc` performance entry type does not deliver: a run that provably
  scavenges 117 times under `--trace-gc` reports zero entries.
- `--trace-gc` itself is ground truth, but V8 writes it to stdout with no
  ordering guarantee against Node's own async stdout writes, so scavenges
  cannot be reliably attributed to a scenario on Windows.

There is also a deeper problem: in a tight monomorphic microbenchmark loop
TurboFan scalar-replaces most of these allocations, so even a correct meter
would read zero for code that does allocate in a real game, where call sites
are polymorphic and the inlining budget is spent. Allocation reductions in this
package were therefore made by reading the code, and are guarded by tests
(object identity, `getBoundingClientRect` call counts) rather than by a
benchmark number.
