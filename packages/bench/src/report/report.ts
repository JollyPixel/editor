// Import Third-party Dependencies
import type { TaskResult } from "tinybench";

// Import Internal Dependencies
import type { BenchmarkFormat } from "../config.ts";
import { JsonReporter } from "./JsonReporter.ts";
import {
  hostMetadata,
  type RuntimeMetadata
} from "./runtime.ts";
import { TableReporter } from "./TableReporter.ts";

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
  /**
   * Heap bytes allocated per operation, set by `--allocations`.
   */
  "B/op"?: number;
}

export interface BenchmarkReport<TRow extends object = BenchmarkRow> {
  suite: string;
  runtime: RuntimeMetadata;
  results: TRow[];
}

export interface ReportInput<TRow extends object = BenchmarkRow> {
  suite: string;
  results: TRow[];
  /**
   * Merged over the host metadata, such as a browser user agent.
   */
  runtime?: Partial<RuntimeMetadata>;
}

export interface Reporter {
  print(report: BenchmarkReport<object>): void;
}

export function hasFailure(
  report: BenchmarkReport
): boolean {
  return report.results.some((row) => row.error !== undefined);
}

export function createReporter(
  format: BenchmarkFormat
): Reporter {
  return format === "json" ? new JsonReporter() : new TableReporter();
}

export function createReport<TRow extends object = BenchmarkRow>(
  input: ReportInput<TRow>
): BenchmarkReport<TRow> {
  return {
    suite: input.suite,
    runtime: {
      ...hostMetadata(),
      ...input.runtime
    },
    results: input.results
  };
}
