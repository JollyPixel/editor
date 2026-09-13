// Import Internal Dependencies
import type { MetricDefinition } from "./MetricDefinition.ts";

export interface StatsThemeColors {
  accent: string;
  bed: string;
  success: string;
  warning: string;
}

export interface ResolvedMetricPalette {
  ink: string;
  bed: string;
}

export type MetricColorResolver = (
  value: string,
  fallback: string
) => string;

export function resolveMetricPalette(
  definition: MetricDefinition,
  theme: StatsThemeColors,
  resolveColor: MetricColorResolver
): ResolvedMetricPalette {
  const ink = directionInk(definition, theme);
  const { palette } = definition;

  return {
    ink: palette?.ink === undefined ?
      ink :
      resolveColor(palette.ink, ink),
    bed: palette?.bed === undefined ?
      theme.bed :
      resolveColor(palette.bed, theme.bed)
  };
}

function directionInk(
  definition: MetricDefinition,
  theme: StatsThemeColors
): string {
  if (definition.better === "higher") {
    return theme.success;
  }
  if (definition.better === "lower") {
    return theme.warning;
  }

  return theme.accent;
}
