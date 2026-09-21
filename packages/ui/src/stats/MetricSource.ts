// Import Internal Dependencies
import type { MetricDefinition } from "./MetricDefinition.ts";

/**
 * Anything that can describe metrics for a recorder to sample.
 */
export interface MetricSource {
  readonly metrics: readonly MetricDefinition[];
}
