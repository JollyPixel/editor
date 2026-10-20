# CLI

`jolly-bench` finds `bench/**/*.bench.ts` under the working directory and runs
the suite each file default-exports, in path order. A file that does not
default-export a suite is an error, and a task that throws sets the exit code
to 1.

```bash
pnpm --filter @jolly-pixel/loop bench               # every suite
pnpm --filter @jolly-pixel/loop bench scheduler     # file paths containing "scheduler"
pnpm --filter @jolly-pixel/loop bench --task steady # task names containing "steady"
pnpm --filter @jolly-pixel/loop bench --json        # one JSON line per suite
pnpm --filter @jolly-pixel/loop bench --allocations # add a B/op column
pnpm --filter @jolly-pixel/loop bench --list        # print the files and exit
```

These run from the monorepo root. From a package directory, `pnpm run bench`
does the same.

## Options

```text
Usage: jolly-bench [filter...] [options]

Options:
  --task <substring>       run only the tasks whose name contains it
  --json                   emit one JSON object per suite instead of a table
  --time <ms>              sampling budget per task (default 500)
  --iterations <n>         minimum samples per task (default 12)
  --warmup-time <ms>       warmup budget per task (default 100)
  --warmup-iterations <n>  minimum warmup samples per task (default 3)
  --batch <n>              calls per iteration for batched tasks (default 100)
  --allocations            add a B/op column, measured after sampling
  --pattern <glob>         override the discovery glob
  --ignore <substring>     skip matching files, repeatable
  --cwd <dir>              directory to discover from
  --list                   print the discovered files and exit
  --help                   print this message
```

Exclude files that are scripts rather than suites, such as a browser run that
boots Vite and Chromium, with `--ignore browser.bench.ts`.

## Environment

```ts
interface BenchEnvironment {
  BENCH_TIME_MS?: string;           // --time
  BENCH_ITERATIONS?: string;        // --iterations
  BENCH_WARMUP_TIME_MS?: string;    // --warmup-time
  BENCH_WARMUP_ITERATIONS?: string; // --warmup-iterations
  BENCH_BATCH?: string;             // --batch
  BENCH_FORMAT?: "table" | "json";  // --json
  BENCH_TASK?: string;              // --task
  BENCH_ALLOCATIONS?: "1" | "0" | "true" | "false"; // --allocations
}
```

- Flags win over the environment. `--help` prints the defaults with the
  `BENCH_*` values applied.
- Flags and variables share one validation: numeric values must be positive,
  so `--batch 0` and `BENCH_BATCH=0` both fail with a `BenchmarkError`.
- An unset or empty variable keeps the default.

## Node flags

Node flags do not pass through the bin. Set `NODE_OPTIONS`, or run the CLI or a
single suite as a file:

```bash
node --max-old-space-size=8192 node_modules/@jolly-pixel/bench/src/cli.ts
node --cpu-prof bench/mesh-build.bench.ts
```

Running a suite file directly needs its `import.meta.main` guard, see
[Suite](./suite.md).

## Allocations

`--allocations` runs each task again after sampling, for at least 100 calls and
up to 1,000 calls or 500 ms, under a `v8.GCProfiler`. It adds the heap freed by
each collection to the heap growth, so a scavenge during the run does not hide
what was allocated. `B/op` divides that by the operations per iteration.

- `process.memoryUsage().heapUsed` alone is not enough for this. It drops at
  every collection.
- The figure is what optimized code allocates. V8 may remove an allocation
  that does not escape a tight loop, and a real caller may not get that.
- Tasks with `beforeEach` or `afterEach` hooks report no `B/op`, because the
  hooks would be counted with the task.
- Use a heap profile to find where the bytes come from, and tests to guard
  allocation-sensitive contracts such as object identity.
