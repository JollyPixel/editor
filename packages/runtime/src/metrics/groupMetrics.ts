// Import Third-party Dependencies
import type { MetricDefinition } from "@jolly-pixel/ui/stats";

export interface MetricGroup {
  /**
   * `null` for the metrics naming no group, which a readout keeps at its root.
   */
  title: string | null;
  metrics: readonly MetricDefinition[];
}

export function groupMetrics(
  definitions: readonly MetricDefinition[]
): readonly MetricGroup[] {
  const groups = new Map<string | null, MetricDefinition[]>();
  for (const definition of definitions) {
    const title = definition.group ?? null;
    const known = groups.get(title);
    if (known === undefined) {
      groups.set(title, [definition]);
      continue;
    }

    known.push(definition);
  }

  return [...groups].map(([title, metrics]) => {
    return {
      title,
      metrics
    };
  });
}
