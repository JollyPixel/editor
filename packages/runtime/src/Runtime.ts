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
  suspendWhenHidden,
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
import type {
  MountedPerformanceStats,
  PerformanceStatsPosition
} from "./stats/mountPerformanceStats.ts";
import {
  mountFocusHint,
  type FocusHintOptions
} from "./ui/focus/mountFocusHint.ts";
import {
  OverlayLayer,
  type OverlayLayerOptions
} from "./ui/overlay/OverlayLayer.ts";
import {
  mountViewHelper,
  type ViewHelperOptions
} from "./ui/viewHelper/mountViewHelper.ts";

// CONSTANTS
const kDefaultStatsPosition = "top-left";
const kDefaultStatsInset = 8;

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

  #focusCanvas: boolean;
  #suspendWhenHidden: boolean;
  #focusHint: FocusHintOptions | null;
  #viewHelper: ViewHelperOptions | null;
  #adaptivePixelRatio: boolean;
  #logger: Systems.Logger;
  #session: AbortController | null = null;
  #statsOverlay: MountedPerformanceStats | null = null;

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
    this.#focusCanvas = options.focusCanvas ?? true;
    this.#suspendWhenHidden = options.suspendWhenHidden ?? false;
    this.#focusHint = resolveToggleOptions(options.focusHint);
    this.#viewHelper = resolveToggleOptions(options.viewHelper);
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
      ...options.loop
    });
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
      await logger.step(
        "stats",
        () => runtime.#initializePerformanceStats(stats)
      );
    }

    return runtime;
  }

  get running() {
    return this.#session !== null;
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
    this.world.once("afterUpdate", () => resolve());

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

    this.#session = new AbortController();
    const { signal } = this.#session;

    this.canvas.focus();
    this.canvas.addEventListener(
      "keypress",
      (event) => event.preventDefault(),
      { signal }
    );
    if (this.#focusCanvas) {
      document.addEventListener(
        "click",
        () => this.#focusCanvasElement(),
        { signal }
      );
    }
    if (this.#focusHint !== null) {
      const focusHint = mountFocusHint(
        this.canvas,
        this.overlay,
        this.#focusHint
      );
      signal.addEventListener("abort", () => focusHint.dispose());
    }
    if (this.#viewHelper !== null) {
      const viewHelper = mountViewHelper(
        this.world.renderer,
        this.#viewHelper
      );
      signal.addEventListener("abort", () => viewHelper.dispose());
    }

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
    if (this.#suspendWhenHidden) {
      void this.nextFrame().then(() => {
        if (!signal.aborted) {
          suspendWhenHidden(this.loop, this.canvas, signal);
        }
      });
    }
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
    session.abort();
    this.world.disconnect();
  }

  dispose() {
    this.stop();
    this.#statsOverlay?.dispose();
    this.#statsOverlay = null;
    this.metrics.dispose();
    this.overlay.dispose();
    this.world.dispose();
  }

  #focusCanvasElement(): void {
    if (document.activeElement !== this.canvas) {
      this.canvas.focus();
    }
  }

  async #initializePerformanceStats(
    option: Exclude<
      RuntimeOptions<TContext>["includePerformanceStats"],
      false | undefined
    >
  ): Promise<void> {
    const settings = typeof option === "object" ? option : {};
    if (settings.mount ?? true) {
      const { mountPerformanceStats } = await import(
        "./stats/mountPerformanceStats.ts"
      );
      this.#statsOverlay = await mountPerformanceStats(
        this.stats,
        this.overlay,
        {
          position: settings.position ?? kDefaultStatsPosition,
          inset: settings.inset ?? kDefaultStatsInset
        }
      );
    }
    if (settings.panel) {
      await this.mountMetricsPanel(
        settings.panel === true ? {} : settings.panel
      );
    }
  }
}

function resolveToggleOptions<TOptions extends object>(
  option: boolean | TOptions | undefined
): Partial<TOptions> | null {
  if (!option) {
    return null;
  }

  return option === true ? {} : option;
}
