// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import { Systems } from "@jolly-pixel/ecs";
import {
  type RuntimeCanvasTarget,
  type RuntimeCoreLoadOptions,
  RuntimeCore,
  type RuntimeCoreOptions,
  type PerformanceStatsOption,
  resolveRuntimeAssetCatalog,
  resolveRuntimeCanvas
} from "@jolly-pixel/runtime";

// Import Internal Dependencies
import { ThreeRenderer } from "../rendering/ThreeRenderer.ts";
import type { RendererMetrics } from "./RendererMetrics.ts";
import {
  ThreeRuntimeBackend,
  type ThreeRuntimeBackendOptions
} from "./ThreeRuntimeBackend.ts";
import type { ViewHelperSettings } from "./viewHelper/ViewHelperSettings.ts";

export type { RuntimeCanvasTarget };

export type RuntimeLoadOptions<
  TContext = Systems.WorldDefaultContext
> = RuntimeCoreLoadOptions<Systems.Scene<TContext>>;

export interface RuntimeOptions<
  TContext = Systems.WorldDefaultContext
> extends RuntimeCoreOptions, ThreeRuntimeBackendOptions<TContext> {
  includePerformanceStats?: false | PerformanceStatsOption;
  /**
   * @default a logger that writes warnings and errors
   */
  logger?: Systems.Logger;
}

export class Runtime<
  TContext = Systems.WorldDefaultContext
> extends RuntimeCore<
    Systems.World<THREE.WebGPURenderer, TContext>,
    Systems.Scene<TContext>,
    RendererMetrics
  > {
  readonly renderer: ThreeRenderer;
  readonly manager: THREE.LoadingManager;
  readonly viewHelper: ViewHelperSettings | null;

  private constructor(
    canvas: HTMLCanvasElement,
    backend: ThreeRuntimeBackend<TContext>,
    options: RuntimeOptions<TContext>
  ) {
    super(canvas, backend, options);

    this.renderer = backend.renderer;
    this.manager = backend.manager;
    this.viewHelper = backend.viewHelper;
  }

  static async create<
    TContext = Systems.WorldDefaultContext
  >(
    target: RuntimeCanvasTarget,
    options: RuntimeOptions<TContext> = Object.create(null)
  ): Promise<Runtime<TContext>> {
    const logger = options.logger ?? new Systems.Logger();
    const canvas = resolveRuntimeCanvas(target);
    const catalog = await logger.step(
      "catalog",
      () => resolveRuntimeAssetCatalog(options.assets?.catalog)
    );
    const renderer = await logger.step(
      "renderer",
      () => ThreeRenderer.create(canvas, options.renderer)
    );

    const runtime = new Runtime(
      canvas,
      new ThreeRuntimeBackend<TContext>(
        renderer,
        catalog,
        logger,
        options
      ),
      {
        ...options,
        logger
      }
    );
    const stats = options.includePerformanceStats;
    if (stats) {
      await logger.step(
        "stats",
        () => runtime.metrics.mount(stats)
      );
    }

    return runtime;
  }

  async compiledFrame(): Promise<void> {
    await this.nextFrame();
    while (this.renderer.pendingCompiles > 0) {
      await this.renderer.compiled();
      await this.nextFrame();
    }
  }
}
