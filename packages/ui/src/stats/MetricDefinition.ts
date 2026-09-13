export type MetricAggregation = "last" | "average" | "max";

export type MetricDirection = "higher" | "lower";

export interface MetricPalette {
  ink?: string;
  bed?: string;
}

export interface MetricDefinition {
  id: string;
  label: string;
  format?: (value: number) => string;
  /**
   * Omit for automatic scaling from the recorded history.
   */
  min?: number;
  max?: number;
  /**
   * Drives the graph colour ramp.
   */
  better?: MetricDirection;
  aggregate?: MetricAggregation;
  palette?: MetricPalette;
  /**
   * Pulled once per refresh window from a live source.
   */
  sample?: () => number;
}

export interface MetricRange {
  min: number;
  max: number;
}

export function resolveMetricRange(
  definition: MetricDefinition,
  history: readonly number[]
): MetricRange {
  const observedMin = history.length === 0 ?
    0 :
    Math.min(...history);
  const observedMax = history.length === 0 ?
    0 :
    Math.max(...history);

  return {
    min: definition.min ?? observedMin,
    max: definition.max ?? observedMax
  };
}
