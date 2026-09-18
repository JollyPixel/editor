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
  bootstrapRuntime,
  type RuntimeLoadOptions
} from "./bootstrap/bootstrapRuntime.ts";
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
  MountedPerformanceStats,
  PerformanceStatsPosition
} from "./stats/mountPerformanceStats.ts";
import {
  mountFocusHint,
  type FocusHintOptions,
  type MountedFocusHint
} from "./ui/focus/mountFocusHint.ts";
import {
  OverlayLayer,
  type OverlayLayerOptions
} from "./ui/overlay/OverlayLayer.ts";
import {
  mountViewHelper,
  type MountedViewHelper,
  type ViewHelperOptions
} from "./ui/viewHelper/mountViewHelper.ts";

// CONSTANTS
const kDefaultStatsPosition = "top-left";
const kDefaultStatsInset = 8;

export interface RuntimeOptions<
  TContext = Systems.WorldDefaultContext
> {
  includePerformanceStats?: boolean | {
    mount?: boolean;
    position?: PerformanceStatsPosition;
    inset?: number;
  };
  focusCanvas?: boolean;
  focusHint?: boolean | FocusHintOptions;
  viewHelper?: boolean | ViewHelperOptions;
  overlay?: OverlayLayerOptions;
  context?: TContext;
  audio?: GlobalAudio;
  assets?: RuntimeAssetOptions;
  loop?: FrameSchedulerOptions;
}

export class Runtime<
  TContext = Systems.WorldDefaultContext
> {
  readonly world: Systems.World<THREE.WebGPURenderer, TContext>;
  readonly loop: GameLoop;

  readonly canvas: HTMLCanvasElement;
  readonly overlay: OverlayLayer;
  stats?: StatsRecorder;
  readonly manager = new THREE.LoadingManager();

  #isRunning = false;
  #focusCanvas: boolean;
  #focusHint: FocusHintOptions | null;
  #viewHelper: ViewHelperOptions | null;
  #statsOverlay: MountedPerformanceStats | null = null;
  #focusHintOverlay: MountedFocusHint | null = null;
  #viewHelperOverlay: MountedViewHelper | null = null;

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
    this.overlay = new OverlayLayer(canvas, options.overlay);
    this.#focusCanvas = options.focusCanvas ?? true;
    this.#focusHint = resolveToggleOptions(options.focusHint);
    this.#viewHelper = resolveToggleOptions(options.viewHelper);
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
    const renderer = await Systems.ThreeRenderer.create(canvas);

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

  load(
    options: RuntimeLoadOptions<TContext> = {}
  ): Promise<void> {
    return bootstrapRuntime(this, options);
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
    if (this.#focusHint !== null) {
      this.#focusHintOverlay = mountFocusHint(
        this.canvas,
        this.overlay,
        this.#focusHint
      );
    }
    if (this.#viewHelper !== null) {
      this.#viewHelperOverlay = mountViewHelper(
        this.world.renderer,
        this.#viewHelper
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
    this.#focusHintOverlay?.dispose();
    this.#focusHintOverlay = null;
    this.#viewHelperOverlay?.dispose();
    this.#viewHelperOverlay = null;

    this.world.disconnect();
  }

  dispose() {
    this.stop();
    this.#statsOverlay?.dispose();
    this.#statsOverlay = null;
    this.overlay.dispose();
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
      this.overlay,
      {
        position: settings.position ?? kDefaultStatsPosition,
        inset: settings.inset ?? kDefaultStatsInset
      }
    );
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
