// Import Internal Dependencies
import type {
  BenchmarkReport,
  Reporter
} from "./report.ts";

export class TableReporter implements Reporter {
  #runtimeReported = false;

  print(
    report: BenchmarkReport<object>
  ): void {
    if (!this.#runtimeReported) {
      console.log("# Runtime");
      console.table(report.runtime);
      this.#runtimeReported = true;
    }

    const { results } = report;
    console.log(`\n# ${report.suite}`);
    console.table(results.length === 1 ? results[0] : results);
  }
}
