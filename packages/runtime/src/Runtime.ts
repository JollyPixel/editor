// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { AssetCatalog } from "@jolly-pixel/asset";
import {
  Systems,
  type GlobalAudio
} from "@jolly-pixel/engine";
import { StatsRecorder } from "@jolly-pixel/ui/stats";
import {
  AnimationLoopFrameSource,
  GameLoop,
  type FrameSchedulerOptions
} from "@jolly-pixel/loop";

// Import Internal Dependencies
import {
  bootstrapRuntime,
  type RuntimeLoadOptions
} from "./bootstrap/bootstrapRuntime.ts";
import {
  createRuntimeAssetCoordinator
} from "./assets/createRuntimeAssetCoordinator.ts";
import type { RuntimeAssetOptions } from "./assets/RuntimeAssetOptions.ts";
import {
  resolveRuntimeAssetCatalog
} from "./assets/resolveRuntimeAssetCatalog.ts";
import { resolveElement } from "./resolveElement.ts";
import { RuntimeMetrics } from "./metrics/RuntimeMetrics.ts";
import type {
  MetricsPanel,
  MetricsPanelOptions
} from "./metrics/MetricsPanel.ts";
import { RuntimeSession } from "./session/RuntimeSession.ts";
import {
  RuntimeSessionSettings
} from "./session/RuntimeSessionSettings.ts";
import {
  PerformanceStatsHud,
  type PerformanceStatsPosition
} from "./stats/PerformanceStatsHud.ts";
import type { FocusHintOptions } from "./ui/focus/mountFocusHint.ts";
import {
  OverlayLayer,
  type OverlayLayerOptions
} from "./ui/overlay/OverlayLayer.ts";
import type { ViewHelperOptions } from "./ui/viewHelper/mountViewHelper.ts";

export type RuntimeCanvasTarget = HTMLCanvasElement | string;

export interface RuntimeOptions<
  TContext = Systems.WorldDefaultContext
> {
  includePerformanceStats?: boolean | {
    mount?: boolean;
    position?: PerformanceStatsPosition;
    inset?: number;
    panel?: boolean | MetricsPanelOptions;
  };
  focusCanvas?: boolean;
  suspendWhenHidden?: boolean;
  renderOnDemand?: boolean;
  focusHint?: boolean | FocusHintOptions;
  viewHelper?: boolean | ViewHelperOptions;
  overlay?: OverlayLayerOptions;
  context?: TContext;
  audio?: GlobalAudio;
  assets?: RuntimeAssetOptions;
  loop?: FrameSchedulerOptions;
  /**
   * Forwarded to `Systems.ThreeRenderer.create()`.
   */
  renderer?: Systems.ThreeRendererOptions;
  /**
   * @default a logger with every namespace disabled
   */
  logger?: Systems.Logger;
}

export class Runtime<
  TContext = Systems.WorldDefaultContext
> {
  readonly world: Systems.World<THREE.WebGPURenderer, TContext>;
  readonly renderer: Systems.ThreeRenderer;
  readonly loop: GameLoop;

  readonly canvas: HTMLCanvasElement;
  readonly overlay: OverlayLayer;
  readonly stats = new StatsRecorder();
  readonly metrics: RuntimeMetrics;
  readonly manager = new THREE.LoadingManager();

  #sessionSettings: RuntimeSessionSettings;
  #adaptivePixelRatio: boolean;
  #logger: Systems.Logger;
  #session: RuntimeSession | null = null;
  #statsHud: PerformanceStatsHud | null = null;

  private constructor(
    canvas: HTMLCanvasElement,
    renderer: Systems.ThreeRenderer,
    catalog: AssetCatalog,
    options: RuntimeOptions<TContext>
  ) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.overlay = new OverlayLayer(canvas, options.overlay);
    this.metrics = new RuntimeMetrics(this.stats, renderer);

    const output = options.renderer?.output;
    this.#adaptivePixelRatio = output?.pixelRatio === undefined &&
      output?.maxPixelRatio === undefined;
    this.#sessionSettings = new RuntimeSessionSettings(options);
    this.#logger = options.logger ?? new Systems.Logger();

    this.world = new Systems.World<THREE.WebGPURenderer, TContext>(renderer, {
      enableOnExit: true,
      sceneManager: new Systems.SceneManager<TContext>(),
      context: options.context,
      audio: options.audio,
      assetCoordinator: createRuntimeAssetCoordinator(
        this.manager,
        catalog,
        options.assets?.loaders
      )
    });
    this.loop = new GameLoop({
      source: new AnimationLoopFrameSource(
        renderer.getSource()
      ),
      ...options.loop,
      keepAlive: this.renderOnDemand ?
        () => this.world.animating ||
          this.world.input.wasActive ||
          this.world.input.mouse.hovering :
        undefined
    });
    this.world.on("invalidate", () => this.loop.invalidate());
  }

  static async create<
    TContext = Systems.WorldDefaultContext
  >(
    target: RuntimeCanvasTarget,
    options: RuntimeOptions<TContext> = Object.create(null)
  ): Promise<Runtime<TContext>> {
    const logger = options.logger ?? new Systems.Logger();
    const canvas = resolveElement(target, HTMLCanvasElement);
    const catalog = await logger.step(
      "catalog",
      () => resolveRuntimeAssetCatalog(options.assets?.catalog)
    );
    const renderer = await logger.step(
      "renderer",
      () => Systems.ThreeRenderer.create(canvas, options.renderer)
    );

    const runtime = new Runtime(
      canvas,
      renderer,
      catalog,
      {
        ...options,
        logger
      }
    );
    const stats = options.includePerformanceStats;
    if (stats) {
      runtime.#statsHud = await logger.step(
        "stats",
        () => PerformanceStatsHud.mount(runtime, stats)
      );
    }

    return runtime;
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

  load(
    options: RuntimeLoadOptions<TContext> = {}
  ): Promise<void> {
    return bootstrapRuntime(this, options, {
      adaptivePixelRatio: this.#adaptivePixelRatio,
      logger: this.#logger
    });
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
    this.world.input.exited = false;
    this.world.connect();
    this.world.start();
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
    this.world.stop();
    this.world.input.exited = true;
    this.loop.stop();
    session.dispose();
    this.world.disconnect();
  }

  dispose() {
    this.stop();
    this.#statsHud?.dispose();
    this.#statsHud = null;
    this.metrics.dispose();
    this.overlay.dispose();
    this.world.dispose();
  }
}
