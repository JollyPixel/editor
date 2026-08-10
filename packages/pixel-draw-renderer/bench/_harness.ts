// Import Node.js Dependencies
import { cpus } from "node:os";

// Import Third-party Dependencies
import { Bench, type Task } from "tinybench";

// Import Internal Dependencies
import type {
  RGBA,
  Vec2
} from "../src/types.ts";

// CONSTANTS
const kDefaultTime = envNumber("BENCH_TIME_MS", 500);
const kDefaultWarmupTime = envNumber("BENCH_WARMUP_TIME_MS", 100);
// tinybench requires both time and iteration floors. Lower floors prevent long
// tasks from running excessively while fast tasks still get enough samples.
const kDefaultIterations = envNumber("BENCH_ITERATIONS", 12);
const kDefaultWarmupIterations = envNumber("BENCH_WARMUP_ITERATIONS", 3);
const kJsonOutput = process.env.BENCH_FORMAT === "json";
const kTaskFilter = process.env.BENCH_TASK;

let runtimeReported = false;

interface BenchmarkRow {
  task: string;
  state?: string;
  error?: string;
  "ops/sec"?: number;
  "mean (ms)"?: number;
  "p50 (ms)"?: number;
  "p99 (ms)"?: number;
  "rme %"?: number;
  samples?: number;
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
  bench: Bench
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
  const rows = bench.tasks.map(toRow);

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
  task: Task
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
    "ops/sec": Math.round(result.throughput.mean),
    "mean (ms)": Number(result.latency.mean.toFixed(4)),
    "p50 (ms)": Number(result.latency.p50.toFixed(4)),
    "p99 (ms)": Number(result.latency.p99.toFixed(4)),
    "rme %": Number(result.throughput.rme.toFixed(2)),
    samples: result.latency.samplesCount
  };
}

/**
 * Deterministic PRNG so fixtures are identical across runs.
 */
export function mulberry32(
  seed = 0x9e3779b9
): () => number {
  let a = seed >>> 0;

  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function randomColor(
  rng: () => number
): RGBA {
  return {
    r: Math.floor(rng() * 256),
    g: Math.floor(rng() * 256),
    b: Math.floor(rng() * 256),
    a: 255
  };
}

/**
 * Generates `count` in-bounds positions for `size`.
 * Duplicates are intentional to mimic brush revisits.
 */
export function randomPositions(
  count: number,
  size: Vec2,
  rng: () => number
): Vec2[] {
  const positions: Vec2[] = new Array(count);

  for (let i = 0; i < count; i++) {
    positions[i] = {
      x: Math.floor(rng() * size.x),
      y: Math.floor(rng() * size.y)
    };
  }

  return positions;
}
