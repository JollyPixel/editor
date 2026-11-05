// Import Third-party Dependencies
import {
  StatsRecorder,
  type MetricSource
} from "@jolly-pixel/ui/stats";
import {
  GameLoop,
  type FrameSchedulerOptions,
  type GameLoopOptions
} from "@jolly-pixel/loop";

// Import Internal Dependencies
import {
  bootstrapRuntime,
  type RuntimeCoreLoadOptions
} from "./startup/bootstrapRuntime.ts";
import type {
  RuntimeBackend,
  RuntimeWorld
} from "./contract/RuntimeBackend.ts";
import {
  SilentLogger,
  type RuntimeLogger
} from "./contract/RuntimeLogger.ts";
import { RuntimeMetrics } from "./metrics/RuntimeMetrics.ts";
import type {
  MetricsPanel,
  MetricsPanelOptions
} from "./metrics/MetricsPanel.ts";
import { RuntimeSession } from "./session/RuntimeSession.ts";
import {
  RuntimeSessionSettings,
  type RuntimeSessionOptions
} from "./session/RuntimeSessionSettings.ts";
import {
  PerformanceStatsHud,
  type PerformanceStatsOption
} from "./metrics/PerformanceStatsHud.ts";
import {
  OverlayLayer,
  type OverlayLayerOptions
} from "./overlay/OverlayLayer.ts";

// CONSTANTS
const kRenderOnDemandIdleDelay = 2000;

export type RuntimeLoopOptions = FrameSchedulerOptions &
  Pick<GameLoopOptions, "idleDelay">;

export interface RuntimeCoreOptions extends RuntimeSessionOptions {
  overlay?: OverlayLayerOptions;
  loop?: RuntimeLoopOptions;
  /**
   * @default a logger that records nothing
   */
  logger?: RuntimeLogger;
}

export class RuntimeCore<
  TWorld extends RuntimeWorld = RuntimeWorld,
  TScene = unknown,
  TMetrics extends MetricSource = MetricSource
> {
  readonly world: TWorld;
  readonly loop: GameLoop;

  readonly canvas: HTMLCanvasElement;
  readonly overlay: OverlayLayer;
  readonly stats = new StatsRecorder();
  readonly metrics: RuntimeMetrics<TMetrics>;

  #backend: RuntimeBackend<TWorld, TScene, TMetrics>;
  #sessionSettings: RuntimeSessionSettings;
  #logger: RuntimeLogger;
  #session: RuntimeSession | null = null;
  #statsHud: PerformanceStatsHud | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    backend: RuntimeBackend<TWorld, TScene, TMetrics>,
    options: RuntimeCoreOptions = {}
  ) {
    this.canvas = canvas;
    this.world = backend.world;
    this.#backend = backend;
    this.#logger = options.logger ?? new SilentLogger();
    this.#sessionSettings = new RuntimeSessionSettings(options);
    this.overlay = new OverlayLayer(canvas, options.overlay);
    this.metrics = new RuntimeMetrics(this.stats, backend.metrics);

    this.loop = new GameLoop({
      source: backend.frameSource,
      idleDelay: kRenderOnDemandIdleDelay,
      ...options.loop,
      keepAlive: this.renderOnDemand ?
        () => this.world.animating || this.world.input.wasActive :
        undefined
    });
    this.loop.on("start", () => this.stats.skipGap());
    this.loop.on("wake", () => this.stats.skipGap());
    this.world.on("invalidate", () => this.loop.invalidate());
  }

  get running() {
    return this.#session !== null;
  }

  get renderOnDemand(): boolean {
    return this.#sessionSettings.renderOnDemand;
  }

  get idle(): boolean {
    return this.loop.sleeping;
  }

  get statsHud(): PerformanceStatsHud | null {
    return this.#statsHud;
  }

  load(
    options: RuntimeCoreLoadOptions<TScene> = {}
  ): Promise<void> {
    return bootstrapRuntime(
      this,
      this.#backend,
      options,
      this.#logger
    );
  }

  nextFrame(): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.world.once(
      "afterUpdate",
      () => resolve()
    );
    this.world.invalidate();

    return promise;
  }

  async frames(
    count: number
  ): Promise<void> {
    for (let index = 0; index < count; index++) {
      await this.nextFrame();
    }
  }

  async mountPerformanceStats(
    option: PerformanceStatsOption = true
  ): Promise<PerformanceStatsHud | null> {
    const hud = await PerformanceStatsHud.mount(this, option);
    this.#statsHud?.dispose();
    this.#statsHud = hud;

    return hud;
  }

  mountMetricsPanel(
    options: MetricsPanelOptions = {}
  ): Promise<MetricsPanel> {
    return this.metrics.mountPanel({
      keyboard: this.world.input.keyboard,
      ...options
    });
  }

  start() {
    if (this.#session !== null) {
      return;
    }

    this.#session = new RuntimeSession(this, this.#sessionSettings);
    this.#backend.start();
    this.loop.start({
      frame: (schedule) => {
        this.stats.begin();
        const exit = this.world.tick(schedule);
        this.stats.end();
        if (exit) {
          this.stop();
        }
      }
    });
  }

  stop() {
    const session = this.#session;
    if (session === null) {
      return;
    }

    this.#session = null;
    this.#backend.stop();
    this.loop.stop();
    session.dispose();
  }

  dispose() {
    this.stop();
    this.#statsHud?.dispose();
    this.#statsHud = null;
    this.metrics.dispose();
    this.overlay.dispose();
    this.#backend.dispose();
  }
}
