// Import Internal Dependencies
import {
  formatBytes,
  formatCount,
  formatDecimal,
  formatInteger,
  formatMilliseconds,
  formatPercent
} from "../monitors/format.ts";

// CONSTANTS
const kUnitFormats: Record<MetricUnit, (value: number) => string> = {
  count: formatCount,
  integer: formatInteger,
  decimal: formatDecimal,
  ms: formatMilliseconds,
  percent: formatPercent,
  bytes: formatBytes
};

export type MetricAggregation =
  | "last"
  | "average"
  | "max";
export type MetricDirection =
  | "higher"
  | "lower";
export type MetricUnit =
  | "count"
  | "integer"
  | "decimal"
  | "ms"
  | "percent"
  | "bytes";

export interface MetricPalette {
  ink?: string;
  bed?: string;
}

export interface MetricDefinition {
  id: string;
  label: string;
  /**
   * Takes precedence over `unit`.
   */
  format?: (value: number) => string;
  unit?: MetricUnit;
  /**
   * Folder a full readout files this metric under. Ungrouped metrics sit at
   * the root of the readout.
   */
  group?: string;
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
   * Included in the one-at-a-time `jolly-stats` cycle. Set `false` for a
   * metric that only belongs in a full readout.
   * @default true
   */
  tile?: boolean;
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
  return {
    min: definition.min ?? observedMin(history),
    max: definition.max ?? observedMax(history)
  };
}

function observedMin(
  history: readonly number[]
): number {
  if (history.length === 0) {
    return 0;
  }

  let min = Infinity;
  for (const value of history) {
    min = Math.min(min, value);
  }

  return min;
}

function observedMax(
  history: readonly number[]
): number {
  if (history.length === 0) {
    return 0;
  }

  let max = -Infinity;
  for (const value of history) {
    max = Math.max(max, value);
  }

  return max;
}

export function resolveMetricFormat(
  definition: MetricDefinition
): (value: number) => string {
  if (definition.format !== undefined) {
    return definition.format;
  }

  return definition.unit === undefined ?
    formatInteger :
    kUnitFormats[definition.unit];
}
