# Suite

A suite is a named set of tinybench tasks, defined in a `bench/**/*.bench.ts`
file that default-exports it.

```ts
// Import Third-party Dependencies
import {
  batched,
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

const suite = defineSuite("loop / primitives", (bench) => {
  const loop = new GameLoop({ source });
  loop.start(handlers);

  bench.add("frame", batched(() => source.step(16)));

  return () => {
    loop.stop();
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
```

The `import.meta.main` guard is optional. It lets `node bench/x.bench.ts` run
the file alone, which is how a profiling run gets its Node flags.

## `defineSuite(name, setup, options?): BenchmarkSuite`

```ts
type SuiteSetup = (bench: Bench) =>
  SuiteTeardown | void | Promise<SuiteTeardown | void>;
type SuiteTeardown = () => void | Promise<void>;

interface SuiteOptions {
  opsPerIteration?: number; // default 1
}

interface BenchmarkSuite {
  name: string;
  run(config: BenchmarkConfig): Promise<BenchmarkReport | null>;
}
```

- `setup` runs on every `run()`, so fixtures are rebuilt each time. The
  function it returns runs after the tasks, even when one throws.
- Build fixtures in `setup` or a tinybench `beforeEach` hook, not inside the
  timed function.
- `run()` returns the report without printing it, or `null` when the task
  filter removed every task.
- A task's operations per iteration are `opsPerIteration`, multiplied by
  `--batch` for a `batched()` task. Above 1, its row gets an `ns/op` column.

## `runSuites(suites, options?): Promise<BenchmarkReport[]>`

```ts
interface RunSuitesOptions {
  config?: BenchmarkConfig; // default BenchmarkConfig.fromEnvironment()
  reporter?: Reporter; // default createReporter(config.format)
}
```

Runs the suites in order and prints each report. Throws a `BenchmarkError`
when no suite produced a report, such as a `--task` filter that matched
nothing.

## `batched(fn): () => void`

The bench given to `setup` calls `fn` `--batch` times per iteration. Called
anywhere else, the returned function throws a `BenchmarkError`.

## `mulberry32(seed?): () => number`

A seeded random generator for fixtures that need random data. The seed keeps
the workload the same between runs. It does not make timings comparable
between machines.
