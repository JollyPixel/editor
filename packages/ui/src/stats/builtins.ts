// Import Internal Dependencies
import type { MetricDefinition } from "./MetricDefinition.ts";
import {
  formatDecimal,
  formatInteger
} from "../monitors/format.ts";

// CONSTANTS
const kBytesPerMebibyte = 1024 * 1024;

export interface PerformanceMemory {
  usedJSHeapSize: number;
  jsHeapSizeLimit?: number;
}

export interface StatsPerformance {
  now(): number;
  memory?: PerformanceMemory;
}

export const FPS_METRIC: MetricDefinition = {
  id: "fps",
  label: "FPS",
  min: 0,
  max: 100,
  better: "higher",
  aggregate: "last",
  palette: {
    ink: "var(--jolly-stats-fps, light-dark(#007c91, #00ffff))",
    bed: "var(--jolly-stats-fps-bed, light-dark(#d8f7fb, #001122))"
  },
  format: formatInteger
};

export const MS_METRIC: MetricDefinition = {
  id: "ms",
  label: "MS",
  min: 0,
  max: 200,
  better: "lower",
  aggregate: "average",
  palette: {
    ink: "var(--jolly-stats-ms, light-dark(#16733a, #00ff66))",
    bed: "var(--jolly-stats-ms-bed, light-dark(#def6e6, #00220d))"
  },
  format: formatDecimal
};

export const WORST_MS_METRIC: MetricDefinition = {
  id: "worstMs",
  label: "WORST MS",
  min: 0,
  max: 200,
  better: "lower",
  aggregate: "max",
  palette: {
    ink: "var(--jolly-stats-worst, light-dark(#a65300, #ff9d00))",
    bed: "var(--jolly-stats-worst-bed, light-dark(#fff0d6, #221100))"
  },
  format: formatDecimal
};

export function memoryMetric(
  performanceSource: StatsPerformance
): MetricDefinition | null {
  if (!hasPerformanceMemory(performanceSource)) {
    return null;
  }
  const { memory } = performanceSource;
  const limit = memory.jsHeapSizeLimit;
  const max = typeof limit === "number" &&
    Number.isFinite(limit) &&
    limit > 0 ?
    limit / kBytesPerMebibyte :
    undefined;

  return {
    id: "mb",
    label: "MB",
    min: 0,
    max,
    better: "lower",
    aggregate: "last",
    palette: {
      ink: "var(--jolly-stats-mb, light-dark(#a6005a, #ff0088))",
      bed: "var(--jolly-stats-mb-bed, light-dark(#ffe0ef, #220011))"
    },
    format: formatInteger,
    sample: () => memory.usedJSHeapSize / kBytesPerMebibyte
  };
}

function hasPerformanceMemory(
  value: StatsPerformance
): value is StatsPerformance & { memory: PerformanceMemory; } {
  return typeof value.memory === "object" &&
    value.memory !== null &&
    typeof value.memory.usedJSHeapSize === "number";
}
