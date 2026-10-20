// Import Internal Dependencies
import { BenchmarkError } from "./errors/index.ts";
import {
  parseChoice,
  parsePositive
} from "./utils/parse.ts";

// CONSTANTS
const kDefaultTime = 500;
const kDefaultWarmupTime = 100;
const kDefaultIterations = 12;
const kDefaultWarmupIterations = 3;
const kDefaultBatch = 100;
const kFormats = ["table", "json"] as const;

export type BenchmarkFormat = typeof kFormats[number];

export interface BenchmarkConfigValues {
  /**
   * Sampling budget per task, in milliseconds.
   */
  time: number;
  /**
   * Minimum samples per task.
   */
  iterations: number;
  /**
   * Warmup budget per task, in milliseconds.
   */
  warmupTime: number;
  /**
   * Minimum warmup samples per task.
   */
  warmupIterations: number;
  /**
   * Calls per iteration made by `batched()`.
   */
  batch: number;
  format: BenchmarkFormat;
  /**
   * Task-name substring; `null` runs every task.
   */
  task: string | null;
  /**
   * Adds a `B/op` column, measured in a separate pass after sampling.
   */
  allocations: boolean;
}

export class BenchmarkConfig implements BenchmarkConfigValues {
  static fromEnvironment(
    env: NodeJS.ProcessEnv = process.env
  ): BenchmarkConfig {
    function read<TValue>(
      name: string,
      fallback: TValue,
      parse: (label: string, raw: string) => TValue
    ): TValue {
      const raw = env[name];

      return raw === undefined || raw === "" ? fallback : parse(name, raw);
    }

    return new BenchmarkConfig({
      time: read("BENCH_TIME_MS", kDefaultTime, parsePositive),
      iterations: read("BENCH_ITERATIONS", kDefaultIterations, parsePositive),
      warmupTime: read(
        "BENCH_WARMUP_TIME_MS",
        kDefaultWarmupTime,
        parsePositive
      ),
      warmupIterations: read(
        "BENCH_WARMUP_ITERATIONS",
        kDefaultWarmupIterations,
        parsePositive
      ),
      batch: read("BENCH_BATCH", kDefaultBatch, parsePositive),
      format: read<BenchmarkFormat>(
        "BENCH_FORMAT",
        "table",
        (label, raw) => parseChoice(label, raw, kFormats)
      ),
      task: env.BENCH_TASK || null,
      allocations: read("BENCH_ALLOCATIONS", false, BenchmarkConfig.#parseSwitch)
    });
  }

  readonly time: number;
  readonly iterations: number;
  readonly warmupTime: number;
  readonly warmupIterations: number;
  readonly batch: number;
  readonly format: BenchmarkFormat;
  readonly task: string | null;
  readonly allocations: boolean;

  constructor(
    values: BenchmarkConfigValues
  ) {
    this.time = values.time;
    this.iterations = values.iterations;
    this.warmupTime = values.warmupTime;
    this.warmupIterations = values.warmupIterations;
    this.batch = values.batch;
    this.format = values.format;
    this.task = values.task;
    this.allocations = values.allocations;
  }

  static #parseSwitch(
    label: string,
    raw: string
  ): boolean {
    if (raw === "1" || raw === "true") {
      return true;
    }
    if (raw === "0" || raw === "false") {
      return false;
    }

    throw new BenchmarkError(
      `${label} expects 1, 0, true or false, got "${raw}"`
    );
  }
}
