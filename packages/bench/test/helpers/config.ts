// Import Internal Dependencies
import {
  BenchmarkConfig,
  type BenchmarkConfigValues
} from "../../src/config.ts";

export function fastConfig(
  overrides: Partial<BenchmarkConfigValues> = {}
): BenchmarkConfig {
  return new BenchmarkConfig({
    time: 1,
    iterations: 1,
    warmupTime: 1,
    warmupIterations: 1,
    batch: 100,
    format: "json",
    task: null,
    allocations: false,
    ...overrides
  });
}
