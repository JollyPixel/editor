# Benchmarks

Raw-performance benchmarks for the package's **headless** hot paths (no DOM).
The DOM layer (`CanvasBuffer`, `CanvasRenderer`) is intentionally excluded: it
would run against the happy-dom canvas mock, not a real browser, so those
numbers would be meaningless. Measure rendering in a browser instead.

Built on [tinybench](https://github.com/tinylibs/tinybench). Fixtures use a
seeded PRNG (`mulberry32`) so runs are comparable across machines.

## Running

```bash
npm run bench -w @jolly-pixel/pixel-draw.renderer   # every suite (~20s)
node bench/flood-fill.bench.ts                       # a single suite
```

## Suites

| File                     | Covers                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| `flood-fill.bench.ts`    | `Fill.floodFill` / `connectedRegion` / `matchAll`                   |
| `pixel-buffer.bench.ts`  | construction (`#fill`), `copyToMaster`, `drawPixels`, `resize`, snapshot clone |
| `history.bench.ts`       | `HistoryStack` undo/redo replay, `groupPositionsByColor`            |
| `network.bench.ts`       | `applyCommandToWorld` (stroke / global-fill), `LastWriteWinsResolver` |
| `colors.bench.ts`        | `colorAsRGBA` / `toRGBA` / `rgbToHex` (colorjs.io parsing)          |

## Adding a benchmark

Export an async `run()` that builds a bench via `createBench(name)`, adds tasks,
and awaits `reportBench(bench)`; guard direct execution with
`if (import.meta.main)`; register the suite in `index.ts`. Keep fixtures
deterministic (seed via `mulberry32`) and out of the timed function — build them
once, or in a tinybench `beforeEach` hook when a task mutates shared state.
