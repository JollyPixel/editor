// Import Internal Dependencies
import type { BenchmarkReport } from "./report.ts";

let runtimeReported = false;

export function tableReporter(
  report: BenchmarkReport
): void {
  if (!runtimeReported) {
    console.log("# Runtime");
    console.table(report.runtime);
    runtimeReported = true;
  }

  console.log(`\n# ${report.suite}`);
  console.table(report.results);
}

export function resetTableReporter(): void {
  runtimeReported = false;
}
