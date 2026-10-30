# Report

A report is one suite's results with the runtime that produced them. Suites and
load harnesses print theirs through a `Reporter`. Benchmarks measured outside
the process, such as browser runs, use the same reporters:

```ts
// Import Third-party Dependencies
import {
  BenchmarkConfig,
  createReport,
  createReporter
} from "@jolly-pixel/bench";

const reporter = createReporter(
  BenchmarkConfig.fromEnvironment().format
);

const report = createReport({
  suite: "pixel-draw / browser canvas and rendering",
  runtime: { userAgent: browserReport.runtime.userAgent },
  results: browserReport.results
});
reporter.print(report);
```

## `createReport(input): BenchmarkReport`

```ts
interface ReportInput<TRow extends object = BenchmarkRow> {
  suite: string;
  results: TRow[];
  runtime?: Partial<RuntimeMetadata>;
}

interface BenchmarkReport<TRow extends object = BenchmarkRow> {
  suite: string;
  runtime: RuntimeMetadata;
  results: TRow[];
}

type HostMetadata = {
  node: string;
  v8: string;
  platform: string;
  cpu: string;
};

type RuntimeMetadata = HostMetadata & Record<string, number | string>;
```

Puts `input.runtime` over the host metadata. It prints nothing.

## `createReporter(format): Reporter`

```ts
interface Reporter {
  print(report: BenchmarkReport<object>): void;
}
```

- `"table"` prints the `# Runtime` table once per reporter, then one table per
  report. A report with a single row prints it vertically.
- `"json"` prints one `{ suite, runtime, results }` line per report.

## Rows

```ts
interface BenchmarkRow {
  task: string;
  state?: TaskResult["state"]; // set instead of measurements when the task did not complete
  error?: string;
  "ns/op"?: number;
  "ops/sec"?: number;
  "mean (ms)"?: number;
  "p50 (ms)"?: number;
  "p99 (ms)"?: number;
  "rme %"?: number;
  samples?: number;
  "B/op"?: number; // set by --allocations
}
```

Compare `ns/op` between runs. For a `batched()` task, `mean (ms)` is the cost
of a whole batch.
