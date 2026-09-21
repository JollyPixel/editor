// Import Third-party Dependencies
import type {
  MetricDefinition,
  MetricSource,
  StatsRecorder
} from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import type { MetricsPanel } from "./MetricsPanel.ts";

export class RuntimeMetrics {
  readonly recorder: StatsRecorder;

  #panel: MetricsPanel | null = null;

  constructor(
    recorder: StatsRecorder
  ) {
    this.recorder = recorder;
  }

  get revision(): number {
    return this.recorder.revision;
  }

  get panel(): MetricsPanel | null {
    return this.#panel;
  }

  attachPanel(
    panel: MetricsPanel | null
  ): void {
    this.#panel = panel;
  }

  addMetric(
    definition: MetricDefinition
  ): () => void {
    return this.recorder.addMetric(definition);
  }

  addSource(
    source: MetricSource
  ): () => void {
    return this.recorder.addSource(source);
  }

  removeMetric(
    id: string
  ): boolean {
    return this.recorder.removeMetric(id);
  }

  track(
    id: string,
    value: number
  ): void {
    this.recorder.track(id, value);
  }
}
