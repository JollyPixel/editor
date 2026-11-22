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
  prepareRuntime,
  type RuntimeCoreLoadOptions
} from "./startup/prepareRuntime.ts";
import type {
  RuntimeBackend,
  RuntimeWorld
} from "./contract/RuntimeBackend.ts";
import {
  SilentLogger,
  type RuntimeLogger
} from "./contract/RuntimeLogger.ts";
import { RuntimeMetrics } from "./metrics/RuntimeMetrics.ts";
import { attachRuntimeSession } from "./session/attachRuntimeSession.ts";
import {
  RuntimeSessionSettings,
  type RuntimeSessionOptions
} from "./session/RuntimeSessionSettings.ts";
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
  #session: AbortController | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    backend: RuntimeBackend<TWorld, TScene, TMetrics>,
    options: RuntimeCoreOptions = {}
  ) {
    this.canvas = canvas;
    this.world = backend.world;
    Reflect.set(globalThis, "game", this.world);
    this.#backend = backend;
    this.#logger = options.logger ?? new SilentLogger();
    this.#sessionSettings = new RuntimeSessionSettings(options);
    this.overlay = new OverlayLayer(canvas, options.overlay);

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

    this.metrics = new RuntimeMetrics(backend.metrics, {
      recorder: this.stats,
      overlay: this.overlay,
      loop: this.loop,
      keyboard: this.world.input.keyboard
    });
  }

  get running() {
    return this.#session !== null;
  }

  get renderOnDemand(): boolean {
    return this.#sessionSettings.renderOnDemand;
  }

  async load(
    options: RuntimeCoreLoadOptions<TScene> = {}
  ): Promise<void> {
    await prepareRuntime(
      this,
      this.#backend,
      this.#logger,
      options
    );
    this.start();

    void this.#logger.step(
      "first frame",
      () => this.nextFrame(),
      { visibility: this.canvas.ownerDocument.visibilityState }
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

  start() {
    if (this.#session !== null) {
      return;
    }

    this.#session = new AbortController();
    attachRuntimeSession(
      this,
      this.#sessionSettings,
      this.#session.signal
    );
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
    session.abort();
  }

  dispose() {
    this.stop();
    this.metrics.dispose();
    this.overlay.dispose();
    this.#backend.dispose();
    if (Reflect.get(globalThis, "game") === this.world) {
      Reflect.deleteProperty(globalThis, "game");
    }
  }
}
