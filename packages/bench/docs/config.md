# Config

`BenchmarkConfig` holds the settings a suite runs with. The CLI builds one from
its flags; a suite run as a file reads it from the environment.

```ts
// Import Third-party Dependencies
import { BenchmarkConfig } from "@jolly-pixel/bench";

const config = BenchmarkConfig.fromEnvironment();
await suite.run(config);
```

## Properties

```ts
type BenchmarkFormat = "table" | "json";

interface BenchmarkConfigValues {
  time: number; // sampling budget per task, in ms
  iterations: number; // minimum samples per task
  warmupTime: number; // warmup budget per task, in ms
  warmupIterations: number; // minimum warmup samples per task
  batch: number; // calls per iteration made by batched()
  format: BenchmarkFormat;
  task: string | null; // task-name substring, null runs every task
  allocations: boolean; // adds the B/op column
}
```

Every property is `readonly` on `BenchmarkConfig`.

## Methods

### `static fromEnvironment(env = process.env): BenchmarkConfig`

Reads the `BENCH_*` variables listed in [CLI](./cli.md#environment). Throws a
`BenchmarkError` on an invalid value.

### `constructor(values: BenchmarkConfigValues)`

Takes the values as given, without validation.
