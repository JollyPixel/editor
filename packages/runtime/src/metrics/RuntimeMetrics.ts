// Import Third-party Dependencies
import type { MetricSource } from "@jolly-pixel/ui/stats";

// Import Internal Dependencies
import type { RuntimeKeyboard } from "../contract/RuntimeBackend.ts";
import type {
  MetricsPanel,
  MetricsPanelOptions
} from "./MetricsPanel.ts";
import type {
  PerformanceStatsHost,
  PerformanceStatsHud,
  PerformanceStatsOption,
  PerformanceStatsPlacement
} from "./PerformanceStatsHud.ts";

export interface RuntimeMetricsHost extends PerformanceStatsHost {
  readonly keyboard: RuntimeKeyboard;
}

export class RuntimeMetrics<
  TMetrics extends MetricSource = MetricSource
> {
  readonly renderer: TMetrics;

  #host: RuntimeMetricsHost;
  #hud: PerformanceStatsHud | null = null;
  #panel: MetricsPanel | null = null;

  constructor(
    renderer: TMetrics,
    host: RuntimeMetricsHost
  ) {
    this.renderer = renderer;
    this.#host = host;
    host.recorder.addSource(renderer);
  }

  get hud(): PerformanceStatsHud | null {
    return this.#hud;
  }

  get panel(): MetricsPanel | null {
    return this.#panel;
  }

  async mount(
    option: PerformanceStatsOption = true
  ): Promise<void> {
    const {
      mount = true,
      panel = false,
      ...placement
    } = option === true ? {} : option;

    await Promise.all([
      mount ? this.mountHud(placement) : null,
      panel ? this.mountPanel(panel === true ? {} : panel) : null
    ]);
  }

  async mountHud(
    placement: PerformanceStatsPlacement = {}
  ): Promise<PerformanceStatsHud> {
    const { PerformanceStatsHud } = await import("./PerformanceStatsHud.ts");

    const hud = new PerformanceStatsHud(this.#host, placement);
    this.#hud?.dispose();
    this.#hud = hud;

    return hud;
  }

  async mountPanel(
    options: MetricsPanelOptions = {}
  ): Promise<MetricsPanel> {
    const { MetricsPanel } = await import("./MetricsPanel.ts");

    const panel = new MetricsPanel(
      this.#host.recorder,
      this.#host.keyboard,
      options
    );
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

  dispose(): void {
    this.#hud?.dispose();
    this.#hud = null;
    this.#panel?.dispose();
    this.#panel = null;
  }

  #unmount(
    panel: MetricsPanel
  ): void {
    panel.dispose();
    if (this.#panel === panel) {
      this.#panel = null;
    }
  }
}
