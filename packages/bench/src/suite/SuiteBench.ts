// Import Third-party Dependencies
import {
  Bench,
  type Fn,
  type FnOptions,
  type Task
} from "tinybench";

// Import Internal Dependencies
import type { BenchmarkConfig } from "../config.ts";
import { BenchmarkError } from "../errors/index.ts";
import type { BenchmarkRow } from "../report/index.ts";
import { bytesPerCall } from "./allocations.ts";
import { batchedBody } from "./batched.ts";

interface RecordedTask {
  fn: Fn;
  options: FnOptions;
  opsPerIteration: number;
}

export class SuiteBench extends Bench {
  #config: BenchmarkConfig;
  #opsPerIteration: number;
  #recorded = new Map<string, RecordedTask>();

  constructor(
    name: string,
    config: BenchmarkConfig,
    opsPerIteration: number
  ) {
    super({
      name,
      time: config.time,
      iterations: config.iterations,
      warmup: true,
      warmupTime: config.warmupTime,
      warmupIterations: config.warmupIterations
    });
    this.#config = config;
    this.#opsPerIteration = opsPerIteration;
  }

  override add(
    name: string,
    fn: Fn,
    options: FnOptions = {}
  ): this {
    const { task: filter, batch } = this.#config;
    if (filter !== null && !name.includes(filter)) {
      return this;
    }

    const body = batchedBody(fn);
    const task = body === undefined ? fn : SuiteBench.#repeat(body, batch);
    this.#recorded.set(name, {
      fn: task,
      options,
      opsPerIteration: body === undefined ?
        this.#opsPerIteration :
        this.#opsPerIteration * batch
    });

    return super.add(name, task, options);
  }

  async measure(): Promise<BenchmarkRow[] | null> {
    if (this.tasks.length === 0) {
      return null;
    }

    await this.run();
    const rows = this.tasks.map((task) => SuiteBench.#row(
      task,
      this.#recordedTask(task).opsPerIteration
    ));
    if (this.#config.allocations) {
      await this.#addAllocations(rows);
    }

    return rows;
  }

  #recordedTask(
    task: Task
  ): RecordedTask {
    const recorded = this.#recorded.get(task.name);
    if (recorded === undefined) {
      throw new BenchmarkError(
        `Task "${task.name}" was not added through the suite bench`
      );
    }

    return recorded;
  }

  async #addAllocations(
    rows: BenchmarkRow[]
  ): Promise<void> {
    for (const [index, task] of this.tasks.entries()) {
      const row = rows[index];
      const recorded = this.#recordedTask(task);
      if (!SuiteBench.#measurable(row, recorded)) {
        continue;
      }

      const { fn, options, opsPerIteration } = recorded;
      await options.beforeAll?.call(task, "run");
      try {
        const bytes = await bytesPerCall(fn);
        row["B/op"] = Math.round(bytes / opsPerIteration);
      }
      finally {
        await options.afterAll?.call(task, "run");
      }
    }
  }

  static #measurable(
    row: BenchmarkRow,
    recorded: RecordedTask
  ): boolean {
    return row.error === undefined &&
      row.state === undefined &&
      recorded.options.beforeEach === undefined &&
      recorded.options.afterEach === undefined;
  }

  static #repeat(
    body: () => void,
    size: number
  ): () => void {
    return function batch() {
      for (let i = 0; i < size; i++) {
        body();
      }
    };
  }

  static #row(
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
}
