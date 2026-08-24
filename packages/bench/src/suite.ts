// Import Third-party Dependencies
import {
  Bench,
  type Task
} from "tinybench";

// Import Internal Dependencies
import { config } from "./config.ts";
import { BenchmarkError } from "./errors/index.ts";
import {
  report,
  type BenchmarkReport,
  type BenchmarkRow
} from "./report/index.ts";

/**
 * Operations per sample; `"batch"` uses the configured batch size.
 */
export type OpsPerIteration = number | "batch";

export interface SuiteOptions {
  opsPerIteration?: OpsPerIteration;
}

export interface BenchmarkSuite {
  name: string;
  /**
   * Returns `null` when the task filter matches nothing.
   */
  run: () => Promise<BenchmarkReport | null>;
}

/**
 * Called after each run when returned by setup.
 */
export type SuiteTeardown = () => void | Promise<void>;

export type SuiteSetup = (bench: Bench) =>
  SuiteTeardown | void | Promise<SuiteTeardown | void>;

export function createBench(
  name: string
): Bench {
  const { time, iterations, warmupTime, warmupIterations } = config();

  return new Bench({
    name,
    time,
    iterations,
    warmup: true,
    warmupTime,
    warmupIterations
  });
}

export function batched(
  fn: () => void
): () => void {
  return function batch() {
    const size = config().batch;

    for (let i = 0; i < size; i++) {
      fn();
    }
  };
}

/**
 * Runs setup before every measurement run.
 */
export function defineSuite(
  name: string,
  setup: SuiteSetup,
  options: SuiteOptions = {}
): BenchmarkSuite {
  const { opsPerIteration = 1 } = options;

  return {
    name,
    async run() {
      const bench = createBench(name);
      const teardown = await setup(bench);

      try {
        return await runBench(name, bench, opsPerIteration);
      }
      finally {
        await teardown?.();
      }
    }
  };
}

async function runBench(
  name: string,
  bench: Bench,
  opsPerIteration: OpsPerIteration
): Promise<BenchmarkReport | null> {
  const { task: filter } = config();
  if (filter !== null) {
    for (const task of bench.tasks) {
      if (!task.name.includes(filter)) {
        bench.remove(task.name);
      }
    }
  }
  if (bench.tasks.length === 0) {
    return null;
  }

  await bench.run();
  const divisor = opsPerIteration === "batch" ?
    config().batch :
    opsPerIteration;

  return report({
    suite: name,
    results: bench.tasks.map((task) => toRow(task, divisor))
  });
}

/**
 * Throws when no task produces a report.
 */
export async function runSuites(
  suites: Iterable<BenchmarkSuite>
): Promise<BenchmarkReport[]> {
  const reports: BenchmarkReport[] = [];

  for (const suite of suites) {
    const value = await suite.run();
    if (value !== null) {
      reports.push(value);
    }
  }

  if (reports.length === 0) {
    const { task } = config();

    throw new BenchmarkError(
      task === null ?
        "No benchmark suite to run" :
        `No benchmark task matched "${task}"`
    );
  }

  return reports;
}

function toRow(
  task: Task,
  opsPerIteration: number
): BenchmarkRow {
  const { result } = task;

  if (result.state === "errored") {
    return {
      task: task.name,
      error: result.error.message
    };
  }
  if (result.state !== "completed") {
    return {
      task: task.name,
      state: result.state
    };
  }

  // Keep ns/op before the whole-batch columns.
  const perOp: Partial<BenchmarkRow> = opsPerIteration > 1 ?
    {
      "ns/op": Number(
        ((result.latency.mean * 1e6) / opsPerIteration).toFixed(1)
      )
    } :
    {};

  return {
    task: task.name,
    ...perOp,
    "ops/sec": Math.round(result.throughput.mean * opsPerIteration),
    "mean (ms)": Number(result.latency.mean.toFixed(6)),
    "p50 (ms)": Number(result.latency.p50.toFixed(6)),
    "p99 (ms)": Number(result.latency.p99.toFixed(6)),
    "rme %": Number(result.throughput.rme.toFixed(2)),
    samples: result.latency.samplesCount
  };
}
