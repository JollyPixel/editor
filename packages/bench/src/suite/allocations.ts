// Import Node.js Dependencies
import {
  GCProfiler,
  getHeapStatistics
} from "node:v8";

// Import Third-party Dependencies
import type { Fn } from "tinybench";

// Import Internal Dependencies
import { BenchmarkError } from "../errors/index.ts";

// CONSTANTS
const kMinCalls = 100;
const kMaxCalls = 1_000;
const kTimeMs = 500;

export async function bytesPerCall(
  fn: Fn
): Promise<number> {
  const profiler = new GCProfiler();
  profiler.start();
  const before = getHeapStatistics().used_heap_size;
  const deadline = performance.now() + kTimeMs;

  let calls = 0;
  while (
    calls < kMinCalls ||
    (calls < kMaxCalls && performance.now() < deadline)
  ) {
    const result = fn();
    if (result instanceof Promise) {
      await result;
    }
    calls++;
  }

  const after = getHeapStatistics().used_heap_size;
  let collected = 0;
  for (const { beforeGC, afterGC } of profiler.stop().statistics) {
    collected += usedHeapSize(beforeGC.heapStatistics) -
      usedHeapSize(afterGC.heapStatistics);
  }

  return Math.max(after - before + collected, 0) / calls;
}

function usedHeapSize(
  statistics: object
): number {
  const value: unknown = Reflect.get(statistics, "usedHeapSize");
  if (typeof value !== "number") {
    throw new BenchmarkError(
      "GCProfiler statistics have no numeric usedHeapSize"
    );
  }

  return value;
}
