// Import Node.js Dependencies
import { cpus } from "node:os";

// Import Third-party Dependencies
import { Bench, type Task } from "tinybench";

// CONSTANTS
const kDefaultTime = envNumber("BENCH_TIME_MS", 500);
const kDefaultWarmupTime = envNumber("BENCH_WARMUP_TIME_MS", 100);
// tinybench requires both time and iteration floors. Lower floors prevent long
// tasks from running excessively while fast tasks still get enough samples.
const kDefaultIterations = envNumber("BENCH_ITERATIONS", 12);
const kDefaultWarmupIterations = envNumber("BENCH_WARMUP_ITERATIONS", 3);
const kJsonOutput = process.env.BENCH_FORMAT === "json";
const kTaskFilter = process.env.BENCH_TASK;

/**
 * Most calls in this package take tens of nanoseconds — below tinybench's own
 * per-iteration overhead, which pins every such task at the same ceiling. Tasks
 * therefore run `kBatch` calls per iteration and the harness divides back out.
 */
export const kBatch = envNumber("BENCH_BATCH", 100);

let runtimeReported = false;

interface BenchmarkRow {
  task: string;
  state?: string;
  error?: string;
  "ns/op"?: number;
  "ops/sec"?: number;
  "mean (ms)"?: number;
  "p99 (ms)"?: number;
  "rme %"?: number;
  samples?: number;
}

/**
 * Wraps a task body so one tinybench iteration performs `kBatch` calls.
 */
export function batched(
  fn: () => void
): () => void {
  return function batch() {
    for (let i = 0; i < kBatch; i++) {
      fn();
    }
  };
}

function envNumber(
  name: string,
  fallback: number
): number {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function runtimeMetadata(): Record<string, number | string> {
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: `${process.platform} ${process.arch}`,
    cpu: cpus()[0]?.model ?? "unknown",
    timeMs: kDefaultTime,
    iterations: kDefaultIterations,
    warmupTimeMs: kDefaultWarmupTime,
    warmupIterations: kDefaultWarmupIterations
  };
}

/**
 * Builds a `Bench` with shared warmup and time-budget defaults.
 */
export function createBench(
  name: string
): Bench {
  return new Bench({
    name,
    time: kDefaultTime,
    iterations: kDefaultIterations,
    warmup: true,
    warmupTime: kDefaultWarmupTime,
    warmupIterations: kDefaultWarmupIterations
  });
}

/**
 * Runs a bench and prints a compact `ops/sec` table.
 */
export async function reportBench(
  bench: Bench,
  opsPerIteration = 1
): Promise<void> {
  if (kTaskFilter) {
    for (const task of bench.tasks) {
      if (!task.name.includes(kTaskFilter)) {
        bench.remove(task.name);
      }
    }
    if (bench.tasks.length === 0) {
      throw new Error(`No benchmark task matched BENCH_TASK=${kTaskFilter}`);
    }
  }

  await bench.run();
  const rows = bench.tasks.map((task) => toRow(task, opsPerIteration));

  if (kJsonOutput) {
    console.log(JSON.stringify({
      suite: bench.name,
      runtime: runtimeMetadata(),
      results: rows
    }));

    return;
  }

  if (!runtimeReported) {
    console.log("# Runtime");
    console.table(runtimeMetadata());
    runtimeReported = true;
  }

  console.log(`\n# ${bench.name}`);
  console.table(rows);
}

function toRow(
  task: Task,
  opsPerIteration: number
): BenchmarkRow {
  const { result } = task;

  if (result.state === "errored") {
    return { task: task.name, error: result.error.message };
  }
  if (result.state !== "completed") {
    return { task: task.name, state: result.state };
  }

  return {
    task: task.name,
    "ns/op": Number(((result.latency.mean * 1e6) / opsPerIteration).toFixed(1)),
    "ops/sec": Math.round(result.throughput.mean * opsPerIteration),
    "mean (ms)": Number(result.latency.mean.toFixed(6)),
    "p99 (ms)": Number(result.latency.p99.toFixed(6)),
    "rme %": Number(result.throughput.rme.toFixed(2)),
    samples: result.latency.samplesCount
  };
}
