// Import Internal Dependencies
import type { MetricDefinition } from "./MetricDefinition.ts";

export interface MetricSource {
  readonly metrics: readonly MetricDefinition[];
}
