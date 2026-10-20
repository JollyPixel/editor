// Import Internal Dependencies
import type {
  BenchmarkReport,
  Reporter
} from "./report.ts";

export class JsonReporter implements Reporter {
  print(
    report: BenchmarkReport<object>
  ): void {
    console.log(JSON.stringify(report));
  }
}
