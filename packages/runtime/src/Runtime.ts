// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  Systems,
  type GlobalAudio
} from "@jolly-pixel/engine";
import type { StatsRecorder } from "@jolly-pixel/ui/stats";
import {
  GameLoop,
  type FrameSchedulerOptions
} from "@jolly-pixel/loop";

// Import Internal Dependencies
import {
  AnimationLoopFrameSource
} from "./AnimationLoopFrameSource.ts";
import {
  createRuntimeAssetCoordinator
} from "./assets/createRuntimeAssetCoordinator.ts";
import type {
  ResolvedRuntimeAssetOptions,
  RuntimeAssetOptions
} from "./assets/RuntimeAssetOptions.ts";
import { RuntimeSceneLoader } from "./assets/RuntimeSceneLoader.ts";
import {
  resolveRuntimeAssetOptions
} from "./assets/resolveRuntimeAssetOptions.ts";
import {
  resolveRuntimeCanvas,
  type RuntimeCanvasTarget
} from "./resolveRuntimeCanvas.ts";
import type {
  MountedPerformanceStats
} from "./stats/mountPerformanceStats.ts";
import type {
  PerformanceStatsPosition
} from "./stats/resolveStatsOverlayX.ts";

export type { PerformanceStatsPosition, RuntimeCanvasTarget };

export interface RuntimeOptions<
  TContext = Systems.WorldDefaultContext
> {
  /**
   * @default false
   * Whether to include performance statistics (eg: FPS, memory usage).
   */
  includePerformanceStats?: boolean | {
    /** Mounts the default HUD. @default true */
    mount?: boolean;
    /** Viewport corner used by the mounted HUD. @default "top-left" */
    position?: PerformanceStatsPosition;
  };
  /**
   * Keeps keyboard focus on the canvas while the runtime is running.
   * @default true
   */
  focusCanvas?: boolean;
  /**
   * Optional context object passed to the World.
   */
  context?: TContext;
  /**
   * Optional global audio object passed to the World.
   * If not provided, a default audio context will be created.
   */
  audio?: GlobalAudio;
  /**
   * Configures the catalog and platform loaders used by runtime asset operations.
   */
  assets?: RuntimeAssetOptions;
  /**
   * Scheduling options
   */
  loop?: FrameSchedulerOptions;
}

/**
 * Owns browser initialization, runtime services, and the engine loop.
 */
export class Runtime<
  TContext = Systems.WorldDefaultContext
> {
  readonly world: Systems.World<THREE.WebGPURenderer, TContext>;
  readonly loop: GameLoop;

  readonly canvas: HTMLCanvasElement;
  stats?: StatsRecorder;
  readonly manager = new THREE.LoadingManager();

  #isRunning = false;
  #focusCanvas: boolean;
  #statsOverlay: MountedPerformanceStats | null = null;

  #focusCanvasHandler = () => {
    if (document.activeElement !== this.canvas) {
      this.canvas.focus();
    }
  };

  #preventKeypressDefaultHandler = (event: KeyboardEvent) => {
    event.preventDefault();
  };

  private constructor(
    canvas: HTMLCanvasElement,
    renderer: Systems.Renderer<THREE.WebGPURenderer>,
    sceneManager: Systems.SceneManager<TContext>,
    options: RuntimeOptions<TContext>,
    assets: ResolvedRuntimeAssetOptions
  ) {
    this.canvas = canvas;
    this.#focusCanvas = options.focusCanvas ?? true;
    const assetCoordinator = createRuntimeAssetCoordinator(
      this.manager,
      assets
    );
    this.world = new Systems.World<THREE.WebGPURenderer, TContext>(renderer, {
      enableOnExit: true,
      sceneManager,
      context: options.context,
      audio: options.audio,
      assetCoordinator
    });
    this.loop = new GameLoop({
      source: new AnimationLoopFrameSource(
        renderer.getSource()
      ),
      ...options.loop
    });
    sceneManager.setSceneLoader(
      new RuntimeSceneLoader(assetCoordinator)
    );
  }

  static async create<
    TContext = Systems.WorldDefaultContext
  >(
    target: RuntimeCanvasTarget,
    options: RuntimeOptions<TContext> = Object.create(null)
  ): Promise<Runtime<TContext>> {
    const canvas = resolveRuntimeCanvas(target);

    const sceneManager = new Systems.SceneManager<TContext>();
    const assets = await resolveRuntimeAssetOptions(options.assets);
    const renderer = await Systems.ThreeRenderer.create(
      canvas,
      {
        sceneManager,
        renderMode: "direct"
      }
    );

    const runtime = new Runtime(
      canvas,
      renderer,
      sceneManager,
      options,
      assets
    );
    await runtime.#initializePerformanceStats(
      options.includePerformanceStats
    );

    return runtime;
  }

  get running() {
    return this.#isRunning;
  }

  start() {
    if (this.#isRunning) {
      return;
    }

    this.#isRunning = true;
    this.canvas.focus();
    this.canvas.addEventListener(
      "keypress",
      this.#preventKeypressDefaultHandler
    );
    if (this.#focusCanvas) {
      document.addEventListener(
        "click",
        this.#focusCanvasHandler
      );
    }

    this.world.connect();
    this.world.start();
    this.loop.start({
      frame: (schedule) => {
        this.stats?.begin();
        const exit = this.world.tick(schedule);
        this.stats?.end();
        if (exit) {
          this.stop();
        }
      }
    });
  }

  stop() {
    if (!this.#isRunning) {
      return;
    }

    this.#isRunning = false;
    this.world.stop();
    this.world.input.exited = true;
    this.loop.stop();

    this.canvas.removeEventListener(
      "keypress",
      this.#preventKeypressDefaultHandler
    );
    if (this.#focusCanvas) {
      document.removeEventListener(
        "click",
        this.#focusCanvasHandler
      );
    }

    this.world.disconnect();
  }

  dispose() {
    this.stop();
    this.#statsOverlay?.dispose();
    this.#statsOverlay = null;
    this.world.dispose();
  }

  async #initializePerformanceStats(
    option: RuntimeOptions<TContext>["includePerformanceStats"]
  ): Promise<void> {
    if (!option) {
      return;
    }

    const { StatsRecorder } = await import("@jolly-pixel/ui/stats");
    this.stats = new StatsRecorder();

    const settings = typeof option === "object" ? option : {};
    const mount = settings.mount ?? true;
    if (!mount) {
      return;
    }

    const { mountPerformanceStats } = await import(
      "./stats/mountPerformanceStats.ts"
    );
    this.#statsOverlay = await mountPerformanceStats(
      this.stats,
      settings.position ?? "top-left"
    );
  }
}
