<h1 align="center">
  bench
</h1>

<p align="center">
  Shared benchmarking harness and CLI for JollyPixel workspaces
</p>

## 💃 Getting Started

This workspace-private package is never published. Add it as a development
dependency, then point the `bench` script at its CLI:

```json
{
  "scripts": {
    "bench": "jolly-bench"
  },
  "devDependencies": {
    "@jolly-pixel/bench": "*"
  }
}
```

The package is not built. It exports TypeScript directly, and Node strips the
types at run time. Changes here reach every workspace immediately.

## 👀 Usage example

A suite is a `bench/**/*.bench.ts` file that default-exports a `defineSuite()`
call. The CLI discovers suites without an aggregator file.

```ts
// Import Third-party Dependencies
import {
  batched,
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { FrameScheduler } from "../src/index.ts";

const suite = defineSuite("loop / FrameScheduler#advance", (bench) => {
  const scheduler = new FrameScheduler();
  let now = 0;

  bench.add("steady 60Hz", batched(() => {
    now += 1000 / 60;
    scheduler.advance(now);
  }));
}, { opsPerIteration: "batch" });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
```

The `import.meta.main` guard is optional. It keeps `node bench/x.bench.ts`
working, which is how a profiling run gets its Node flags.

`setup` runs on every `run()`, so fixtures are rebuilt per run. Return a
function from it to release anything the tasks keep alive:

```ts
const suite = defineSuite("loop / primitives", (bench) => {
  const loop = new GameLoop({ source });
  loop.start(handlers);

  bench.add("frame", batched(() => source.step(16)));

  return () => {
    loop.stop();
  };
});
```

Build deterministic fixtures in `setup` or a tinybench `beforeEach` hook, not
inside the timed function. `mulberry32()` provides seeded input when a fixture
needs random data. A seed keeps the workload repeatable; it does not make
timings comparable between machines.

Benchmarks measured outside this process, such as browser runs, use the same
reporters:

```ts
report({
  suite: "pixel-draw / browser canvas and rendering",
  runtime: { userAgent: browserReport.runtime.userAgent },
  results: browserReport.results
});
```

## 🖥️ CLI

```bash
npm run bench -w @jolly-pixel/loop     # every suite, in path order
npm run bench -w @jolly-pixel/loop -- scheduler     # matching file paths
npm run bench -w @jolly-pixel/loop -- --task steady # matching task names
npm run bench -w @jolly-pixel/loop -- --json        # JSON per suite
npm run bench -w @jolly-pixel/loop -- --list        # print what would run
npx jolly-bench --help
```

The workspace commands run from the monorepo root. From a package directory,
the equivalent commands can call `npx jolly-bench` directly.

| Flag | Environment | Default |
| --- | --- | --- |
| `--time <ms>` | `BENCH_TIME_MS` | `500` |
| `--iterations <n>` | `BENCH_ITERATIONS` | `12` |
| `--warmup-time <ms>` | `BENCH_WARMUP_TIME_MS` | `100` |
| `--warmup-iterations <n>` | `BENCH_WARMUP_ITERATIONS` | `3` |
| `--batch <n>` | `BENCH_BATCH` | `100` |
| `--json` | `BENCH_FORMAT=json` | table output |
| `--task <substring>` | `BENCH_TASK` | every task |
| `--pattern <glob>` | n/a | `bench/**/*.bench.ts` |
| `--ignore <substring>` | n/a | nothing |
| `--cwd <dir>` | n/a | the working directory |

Flags win over the environment. Files that are scripts rather than suites, such
as a browser run that boots Vite and Chromium, are excluded with
`--ignore browser.bench.ts`.

Flags and environment variables use the same validation. `BENCH_BATCH=0` and
`--batch 0` both fail. Numeric `BENCH_*` values must be positive, and
`BENCH_FORMAT` accepts only `table` or `json`. Invalid values raise a
`BenchmarkError`; unset and empty variables keep the default.

Node flags cannot pass through the bin shim. Use `NODE_OPTIONS`, or run the CLI
as a file:

```bash
node --max-old-space-size=8192 node_modules/@jolly-pixel/bench/bin/index.ts
node --cpu-prof bench/mesh-build.bench.ts
```

## 📚 API

`bin/` contains the `jolly-bench` entrypoint. `src/` contains the public suite,
configuration, reporting, error, and PRNG modules, plus internal helpers such
as the shared numeric parser. CLI-only behavior stays in `bin/`.

| Export | Purpose |
| --- | --- |
| `defineSuite(name, setup, options?)` | Declares a suite; `setup` may return a teardown |
| `runSuites(suites)` | Runs suites in order, throws when a filter matched nothing |
| `batched(fn)` | Wraps a body so one iteration performs `--batch` calls |
| `createBench(name)` | A bare tinybench `Bench` with the shared defaults |
| `report({ suite, results, runtime? })` | Prints rows measured elsewhere |
| `mulberry32(seed?)` | Deterministic PRNG, so fixtures match across machines |
| `config()` / `configure()` | The active sampling configuration |
| `discover()` / `loadSuite()` | What the CLI uses to find and import suites |
| `hasFailure(report)` | True when a task of the report errored |
| `BenchmarkError` | Raised when a run has nothing to measure, or is misconfigured |

Built on [tinybench][tinybench], which is the only dependency. The CLI adds
none.

## 🥊 Why tasks are batched

Many measured calls take tens of nanoseconds. That is below tinybench's
per-iteration overhead, so direct measurements can hide real differences.

`batched()` performs `--batch` calls (default 100) per iteration, and
`opsPerIteration: "batch"` divides that back out into the **ns/op** column.
That column is the one to compare; `mean (ms)` is the cost of a whole batch.
Suites that do not batch report no `ns/op` at all.

Assign otherwise-unused results to a sink so V8 cannot remove the measured
work.

## 🔬 Measurement limits

Run browser APIs such as canvas and layout in a real browser. A happy-dom mock
is useful for tests, but its timings do not represent browser work. A headless
suite can still count calls such as `getBoundingClientRect()` when the count is
the behavior under test.

Do not derive bytes per operation from `process.memoryUsage().heapUsed`. The
value changes at garbage-collection boundaries, and V8 may remove allocations
from a tight monomorphic loop. Use a heap profile to investigate allocation
behavior and tests to guard allocation-sensitive contracts such as object
identity.

## ✨ Contributors guide

Read the [CONTRIBUTING][contributing] guide before contributing.

After making changes, run the tests and linter:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> New features and bug fixes need tests.

## 📃 License

MIT

[tinybench]: https://github.com/tinylibs/tinybench
[contributing]: ../../CONTRIBUTING.md
