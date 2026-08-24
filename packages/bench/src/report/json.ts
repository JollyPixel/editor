// Import Internal Dependencies
import type { BenchmarkReport } from "./report.ts";

export function jsonReporter(
  report: BenchmarkReport
): void {
  console.log(JSON.stringify(report));
}
