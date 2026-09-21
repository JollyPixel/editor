/**
 * Structurally compatible with `MetricDefinition` of `@jolly-pixel/ui/stats`,
 * declared here so this package depends on no UI library.
 */
export interface VoxelMetric {
  id: string;
  label: string;
  /**
   * What the value measures, which a display maps to a formatter.
   */
  unit?: "count" | "decimal" | "ms" | "percent";
  /**
   * Which direction reads as an improvement, for a graph colour ramp.
   */
  better?: "higher" | "lower";
  /**
   * Folder a full readout files the metric under.
   */
  group?: string;
  /**
   * Included in a one-metric-at-a-time tile.
   */
  tile?: boolean;
  sample(): number;
}
