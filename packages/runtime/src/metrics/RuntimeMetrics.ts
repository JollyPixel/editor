// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
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
import { RendererMetrics } from "./RendererMetrics.ts";

export type RuntimeMetricsRenderer = Pick<
  Systems.ThreeRenderer,
  "getSource" | "on" | "off"
>;

export class RuntimeMetrics {
  readonly renderer: RendererMetrics;

  #recorder: StatsRecorder;
  #source: RuntimeMetricsRenderer;
  #panel: MetricsPanel | null = null;

  #captureFrame = () => {
    this.renderer.captureFrame();
  };

  constructor(
    recorder: StatsRecorder,
    renderer: RuntimeMetricsRenderer
  ) {
    this.#recorder = recorder;
    this.#source = renderer;
    this.renderer = new RendererMetrics(renderer.getSource());
    recorder.addSource(this.renderer);
    renderer.on("draw", this.#captureFrame);
  }

  get panel(): MetricsPanel | null {
    return this.#panel;
  }

  async mountPanel(
    options: MetricsPanelOptions = {}
  ): Promise<MetricsPanel> {
    const { MetricsPanel } = await import("./MetricsPanel.ts");

    this.#panel?.dispose();
    this.#panel = new MetricsPanel(this.#recorder, options);

    return this.#panel;
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
    this.#source.off("draw", this.#captureFrame);
    this.#panel?.dispose();
    this.#panel = null;
  }
}
