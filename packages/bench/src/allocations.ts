// Import Node.js Dependencies
import {
  GCProfiler,
  getHeapStatistics
} from "node:v8";

// Import Third-party Dependencies
import {
  Bench,
  type Fn,
  type FnOptions,
  type Task
} from "tinybench";

// Import Internal Dependencies
import { BenchmarkError } from "./errors/index.ts";

// CONSTANTS
const kMaxCalls = 1_000;

export interface AllocationBudget {
  minCalls: number;
  timeMs: number;
}

interface RecordedTask {
  fn: Fn;
  options: FnOptions;
}

export class RecordingBench extends Bench {
  #recorded = new Map<string, RecordedTask>();

  override add(
    name: string,
    fn: Fn,
    options: FnOptions = {}
  ): this {
    this.#recorded.set(name, {
      fn,
      options
    });

    return super.add(name, fn, options);
  }

  async bytesPerCall(
    task: Task,
    budget: AllocationBudget
  ): Promise<number | null> {
    const recorded = this.#recorded.get(task.name);
    if (
      recorded === undefined ||
      recorded.options.beforeEach !== undefined ||
      recorded.options.afterEach !== undefined
    ) {
      return null;
    }

    const { fn, options } = recorded;
    await options.beforeAll?.call(task, "run");
    try {
      return await measure(fn, budget);
    }
    finally {
      await options.afterAll?.call(task, "run");
    }
  }
}

async function measure(
  fn: Fn,
  budget: AllocationBudget
): Promise<number> {
  const profiler = new GCProfiler();
  profiler.start();
  const before = getHeapStatistics().used_heap_size;
  const deadline = performance.now() + budget.timeMs;

  let calls = 0;
  while (
    calls < budget.minCalls ||
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
