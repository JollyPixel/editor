# Benchmarks

Raw-performance benchmarks for the package's **headless** hot paths (no DOM).
The DOM layer (`CanvasBuffer`, `CanvasRenderer`) is intentionally excluded: it
would run against the happy-dom canvas mock, not a real browser, so those
numbers would be meaningless. Measure rendering in a browser instead.

Built on [tinybench](https://github.com/tinylibs/tinybench). Fixtures use a
seeded PRNG (`mulberry32`) so runs are comparable across machines.

## Running

```bash
npm run bench -w @jolly-pixel/pixel-draw.renderer   # every suite (~40s)
node bench/flood-fill.bench.ts                       # a single suite
BENCH_FORMAT=json npm run bench -w @jolly-pixel/pixel-draw.renderer
npm run bench:browser -w @jolly-pixel/pixel-draw.renderer
```

The harness reports runtime metadata plus mean, p50, p99, relative margin of
error, and sample count. Use `BENCH_TIME_MS`, `BENCH_ITERATIONS`,
`BENCH_WARMUP_TIME_MS`, and `BENCH_WARMUP_ITERATIONS` to increase the sampling
budget for regression runs. `BENCH_FORMAT=json` emits one JSON object per suite
for storage and comparison in CI. Set `BENCH_TASK` to a task-name substring to
run one case in isolation when investigating GC-sensitive results.

`bench:browser` starts an isolated Vite server and headless Chromium instance.
It measures real canvas synchronization and frame rendering, which cannot be
represented by the happy-dom test canvas.

## Suites

| File                     | Covers                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| `flood-fill.bench.ts`    | `Fill.floodFill` / `connectedRegion` / `matchAll`                   |
| `pixel-buffer.bench.ts`  | construction, drawing, transparency scans, resize, commit, snapshot clone    |
| `history.bench.ts`       | `HistoryStack` undo/redo replay, `groupPositionsByColor`            |
| `network.bench.ts`       | `applyCommandToBuffer` (stroke / global-fill), `LastWriteWinsResolver` |
| `colors.bench.ts`        | `colorAsRGBA` / `toRGBA` / `rgbToHex` (colorjs.io parsing)          |
| `tools.bench.ts`         | brush geometry, line rasterization, shape selection, transforms, contours |
| `browser.bench.ts`       | real Chromium canvas synchronization and frame rendering              |

## Adding a benchmark

Export an async `run()` that builds a bench via `createBench(name)`, adds tasks,
and awaits `reportBench(bench)`; guard direct execution with
`if (import.meta.main)`; register the suite in `index.ts`. Keep fixtures
deterministic (seed via `mulberry32`) and out of the timed function — build them
once, or in a tinybench `beforeEach` hook when a task mutates shared state.
