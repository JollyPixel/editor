// Import Internal Dependencies
import type { MetricDefinition } from "./MetricDefinition.ts";

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
  format: formatInteger
};

export const MS_METRIC: MetricDefinition = {
  id: "ms",
  label: "MS",
  min: 0,
  max: 200,
  better: "lower",
  aggregate: "average",
  format: formatDecimal
};

export const WORST_MS_METRIC: MetricDefinition = {
  id: "worstMs",
  label: "WORST MS",
  min: 0,
  max: 200,
  better: "lower",
  aggregate: "max",
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

function formatInteger(
  value: number
): string {
  return String(Math.round(value));
}

function formatDecimal(
  value: number
): string {
  return value.toFixed(1);
}
