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
types at run time.

## 👀 Usage example

A suite is a `bench/**/*.bench.ts` file that default-exports a `defineSuite()`
call:

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
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
```

## 🖥️ CLI

```bash
pnpm --filter @jolly-pixel/loop bench               # every suite
pnpm --filter @jolly-pixel/loop bench scheduler     # matching file paths
pnpm --filter @jolly-pixel/loop bench --task steady # matching task names
pnpm --filter @jolly-pixel/loop bench --json        # JSON per suite
```

Flags, `BENCH_*` variables and Node flags are in [CLI](./docs/cli.md).

## 📚 API

The package exports the modules below, plus `BenchmarkError`. Built on
[tinybench][tinybench].

- [Suite](./docs/suite.md): `defineSuite`, `runSuites`, `batched` and `mulberry32`.
- [Config](./docs/config.md): `BenchmarkConfig`.
- [Report](./docs/report.md): `createReport`, `createReporter` and the row columns.
- [Load](./docs/load.md): `LoadHarness`, `Flag`, `runLoadDriver`, `runLoadServer` and `LoadMeter`.

## 🥊 Why tasks are batched

Many measured calls take tens of nanoseconds, below tinybench's per-iteration
overhead. `batched()` makes `--batch` calls (default 100) per iteration, and
the suite divides them back out into the **ns/op** column, the one to compare.
Assign otherwise-unused results to a sink so V8 cannot remove the measured
work.

## 🔬 Measurement limits

Time browser APIs such as canvas and layout in a real browser: happy-dom
timings do not represent browser work, though a headless suite can still count
calls such as `getBoundingClientRect()`. `--allocations` reports what optimized
code allocates, which a real caller may not match; see
[Allocations](./docs/cli.md#allocations).

## ✨ Contributors guide

Read the [CONTRIBUTING][contributing] guide before contributing.

After making changes, run the tests and linter:

```bash
$ pnpm run test
$ pnpm run lint
```

> [!CAUTION]
> New features and bug fixes need tests.

## 📃 License

MIT

[tinybench]: https://github.com/tinylibs/tinybench
[contributing]: ../../CONTRIBUTING.md
