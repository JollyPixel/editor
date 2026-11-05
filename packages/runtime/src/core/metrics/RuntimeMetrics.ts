// Import Third-party Dependencies
import type {
  MetricDefinition,
  MetricSource,
  StatsRecorder
} from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import type {
  MetricsPanel,
  MetricsPanelOptions
} from "./MetricsPanel.ts";

export class RuntimeMetrics<
  TMetrics extends MetricSource = MetricSource
> {
  readonly renderer: TMetrics;

  #recorder: StatsRecorder;
  #panel: MetricsPanel | null = null;

  constructor(
    recorder: StatsRecorder,
    renderer: TMetrics
  ) {
    this.#recorder = recorder;
    this.renderer = renderer;
    recorder.addSource(renderer);
  }

  get panel(): MetricsPanel | null {
    return this.#panel;
  }

  async mountPanel(
    options: MetricsPanelOptions = {}
  ): Promise<MetricsPanel> {
    const { MetricsPanel } = await import("./MetricsPanel.ts");

    const panel = new MetricsPanel(this.#recorder, options);
    const { signal } = options;
    if (signal?.aborted) {
      panel.dispose();

      return panel;
    }

    this.#panel?.dispose();
    this.#panel = panel;
    signal?.addEventListener(
      "abort",
      () => this.#unmount(panel),
      { once: true }
    );

    return panel;
  }

  #unmount(
    panel: MetricsPanel
  ): void {
    panel.dispose();
    if (this.#panel === panel) {
      this.#panel = null;
    }
  }

  addMetric(
    definition: MetricDefinition
  ): () => void {
    return this.#recorder.addMetric(definition);
  }

  addSource(
    source: MetricSource
  ): () => void {
    return this.#recorder.addSource(source);
  }

  removeMetric(
    id: string
  ): boolean {
    return this.#recorder.removeMetric(id);
  }

  track(
    id: string,
    value: number
  ): void {
    this.#recorder.track(id, value);
  }

  dispose(): void {
    this.#panel?.dispose();
    this.#panel = null;
  }
}
