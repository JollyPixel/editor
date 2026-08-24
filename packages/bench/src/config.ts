// Import Internal Dependencies
import { BenchmarkError } from "./errors/index.ts";
import { positiveNumber } from "./utils/parse.ts";

// CONSTANTS
const kDefaultTime = 500;
const kDefaultWarmupTime = 100;
// Low iteration floors limit slow tasks while fast tasks use the time budgets.
const kDefaultIterations = 12;
const kDefaultWarmupIterations = 3;
const kDefaultBatch = 100;
const kFormats = ["table", "json"] as const;

export type BenchmarkFormat = typeof kFormats[number];

export interface BenchmarkConfig {
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
}

// Delay environment validation until config() is read.
let current: BenchmarkConfig | null = null;

/**
 * Suite modules may load before CLI flags are applied, so callers read this
 * lazily.
 *
 * @throws {BenchmarkError} When a `BENCH_*` variable is invalid.
 */
export function config(): Readonly<BenchmarkConfig> {
  current ??= fromEnvironment();

  return current;
}

export function configure(
  overrides: Partial<BenchmarkConfig>
): Readonly<BenchmarkConfig> {
  const active = config();

  current = {
    time: pick(overrides.time, active.time),
    iterations: pick(overrides.iterations, active.iterations),
    warmupTime: pick(overrides.warmupTime, active.warmupTime),
    warmupIterations: pick(overrides.warmupIterations, active.warmupIterations),
    batch: pick(overrides.batch, active.batch),
    format: pick(overrides.format, active.format),
    task: pick(overrides.task, active.task)
  };

  return current;
}

export function resetConfig(): Readonly<BenchmarkConfig> {
  current = fromEnvironment();

  return current;
}

function pick<T>(
  override: T | undefined,
  fallback: T
): T {
  return override === undefined ? fallback : override;
}

function fromEnvironment(): BenchmarkConfig {
  return {
    time: envNumber("BENCH_TIME_MS", kDefaultTime),
    iterations: envNumber("BENCH_ITERATIONS", kDefaultIterations),
    warmupTime: envNumber("BENCH_WARMUP_TIME_MS", kDefaultWarmupTime),
    warmupIterations: envNumber(
      "BENCH_WARMUP_ITERATIONS",
      kDefaultWarmupIterations
    ),
    batch: envNumber("BENCH_BATCH", kDefaultBatch),
    format: envFormat("BENCH_FORMAT", "table"),
    task: process.env.BENCH_TASK || null
  };
}

function envNumber(
  name: string,
  fallback: number
): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = positiveNumber(raw);
  if (value === null) {
    throw new BenchmarkError(`${name} expects a positive number, got "${raw}"`);
  }

  return value;
}

function envFormat(
  name: string,
  fallback: BenchmarkFormat
): BenchmarkFormat {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  if (!isFormat(raw)) {
    throw new BenchmarkError(
      `${name} expects one of ${kFormats.join(", ")}, got "${raw}"`
    );
  }

  return raw;
}

function isFormat(
  value: string
): value is BenchmarkFormat {
  return kFormats.some((format) => format === value);
}
