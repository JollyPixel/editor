// Import Third-party Dependencies
import { Bench, type Task } from "tinybench";

// Import Internal Dependencies
import type {
  RGBA,
  Vec2
} from "../src/types.ts";

// CONSTANTS
const kDefaultTime = 500;
const kDefaultWarmupTime = 100;
// Iteration floors are kept low: tinybench runs until BOTH the time budget and
// the iteration floor are met, so the stock floors (64 run / 16 warmup) make a
// heavy 200ms+ task run for ~19s. Fast tasks still collect ample samples from
// the time budget alone.
const kDefaultIterations = 12;
const kDefaultWarmupIterations = 3;

/**
 * Builds a `Bench` with the suite-wide defaults: a warmed-up, time-bounded
 * run so every task gets a comparable number of samples regardless of speed.
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
 * Runs a bench and prints a compact `ops/sec` table. Tasks run sequentially
 * (tinybench default) so one task's allocations do not skew the next.
 */
export async function reportBench(
  bench: Bench
): Promise<void> {
  console.log(`\n# ${bench.name}`);
  await bench.run();
  console.table(bench.table(toRow));
}

function toRow(
  task: Task
): Record<string, number | string> {
  const { result } = task;

  if (result.state === "errored") {
    return { task: task.name, error: result.error.message };
  }
  if (result.state !== "completed") {
    return { task: task.name, state: result.state };
  }

  return {
    task: task.name,
    "ops/sec": Math.round(result.throughput.mean).toLocaleString("en-US"),
    "avg (ms)": Number(result.latency.mean.toFixed(4)),
    "± rme %": Number(result.throughput.rme.toFixed(2)),
    samples: result.throughput.samplesCount
  };
}

/**
 * Deterministic PRNG (mulberry32) so fixtures are identical across runs and
 * benchmark numbers stay comparable machine-to-machine.
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
 * `count` in-bounds positions for a `size.x` x `size.y` buffer. Duplicates are
 * allowed — a real brush stroke revisits pixels too.
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
