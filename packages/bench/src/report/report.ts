// Import Third-party Dependencies
import type { TaskResult } from "tinybench";

// Import Internal Dependencies
import { config } from "../config.ts";
import { jsonReporter } from "./json.ts";
import {
  runtimeMetadata,
  type RuntimeMetadata
} from "./runtime.ts";
import { tableReporter } from "./table.ts";

/**
 * Batched rows include `ns/op`; `mean (ms)` covers the whole batch.
 */
export interface BenchmarkRow {
  task: string;
  /**
   * Set instead of measurements when the task did not complete.
   */
  state?: TaskResult["state"];
  error?: string;
  "ns/op"?: number;
  "ops/sec"?: number;
  "mean (ms)"?: number;
  "p50 (ms)"?: number;
  "p99 (ms)"?: number;
  "rme %"?: number;
  samples?: number;
}

export interface BenchmarkReport {
  suite: string;
  runtime: RuntimeMetadata;
  results: BenchmarkRow[];
}

export interface ReportInput {
  suite: string;
  results: BenchmarkRow[];
  /**
   * Metadata from an external runtime, merged over host metadata.
   */
  runtime?: Partial<RuntimeMetadata>;
}

export function hasFailure(
  report: BenchmarkReport
): boolean {
  return report.results.some((row) => row.error !== undefined);
}

export function report(
  input: ReportInput
): BenchmarkReport {
  const value: BenchmarkReport = {
    suite: input.suite,
    runtime: {
      ...runtimeMetadata(),
      ...input.runtime
    },
    results: input.results
  };

  if (config().format === "json") {
    jsonReporter(value);
  }
  else {
    tableReporter(value);
  }

  return value;
}
