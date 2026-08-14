// Import Third-party Dependencies
import Stats from "stats.js";
import * as THREE from "three/webgpu";
import {
  Systems,
  type GlobalAudio
} from "@jolly-pixel/engine";

// Import Internal Dependencies
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

export interface RuntimeOptions<
  TContext = Systems.WorldDefaultContext
> {
  /**
   * @default false
   * Whether to include performance statistics (eg: FPS, memory usage).
   */
  includePerformanceStats?: boolean;
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
}

/**
 * Owns browser initialization, runtime services, and the engine loop.
 */
export class Runtime<
  TContext = Systems.WorldDefaultContext
> {
  readonly world: Systems.World<THREE.WebGPURenderer, TContext>;

  readonly canvas: HTMLCanvasElement;
  stats?: Stats;
  readonly manager = new THREE.LoadingManager();

  #isRunning = false;
  #focusCanvas: boolean;

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
    sceneManager.setSceneLoader(
      new RuntimeSceneLoader(assetCoordinator)
    );

    if (options.includePerformanceStats) {
      this.stats = new Stats();
      this.stats.showPanel(0);
      this.stats.dom.removeAttribute("style");
      this.stats.dom.classList.add("stats");
    }
  }

  /**
   * Resolves the asset catalog and initializes the renderer before creating
   * the Runtime instance.
   */
  static async create<
    TContext = Systems.WorldDefaultContext
  >(
    canvas: HTMLCanvasElement,
    options: RuntimeOptions<TContext> = Object.create(null)
  ): Promise<Runtime<TContext>> {
    if (!canvas) {
      throw new Error(
        "Canvas element is required to create a Runtime instance."
      );
    }

    const sceneManager = new Systems.SceneManager<TContext>();
    const assets = await resolveRuntimeAssetOptions(options.assets);
    const renderer = await Systems.ThreeRenderer.create(
      canvas,
      {
        sceneManager,
        renderMode: "direct"
      }
    );

    return new Runtime(
      canvas,
      renderer,
      sceneManager,
      options,
      assets
    );
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

    if (this.stats) {
      document.body.appendChild(this.stats.dom);
    }

    this.world.connect();
    this.world.start();
    const renderer = this.world.renderer.getSource();
    renderer.setAnimationLoop(() => {
      this.stats?.begin();
      const exit = this.world.tick();
      this.stats?.end();
      if (exit) {
        this.stop();
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
    const renderer = this.world.renderer.getSource();
    renderer.setAnimationLoop(null);

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

  /**
   * Stops the runtime and releases the GPU context. Call this when the
   * canvas is torn down; the Runtime must not be started again afterwards.
   */
  dispose() {
    this.stop();
    this.stats?.dom.remove();
    this.world.dispose();
  }
}
