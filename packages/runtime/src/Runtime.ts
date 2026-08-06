// Import Third-party Dependencies
import Stats from "stats.js";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  Systems,
  type GlobalAudio
} from "@jolly-pixel/engine";

export interface RuntimeOptions<
  TContext = Systems.WorldDefaultContext
> {
  /**
   * @default false
   * Whether to include performance statistics (eg: FPS, memory usage).
   */
  includePerformanceStats?: boolean;
  /**
   * Optional context object passed to the World.
   */
  context?: TContext;
  /**
   * Optional global audio object passed to the World.
   * If not provided, a default audio context will be created.
   */
  audio?: GlobalAudio;
}

export class Runtime<
  TContext = Systems.WorldDefaultContext
> {
  world: Systems.World<THREE.WebGPURenderer, TContext>;

  canvas: HTMLCanvasElement;
  stats?: Stats;
  manager = new THREE.LoadingManager();

  #isRunning = false;

  private constructor(
    canvas: HTMLCanvasElement,
    renderer: Systems.Renderer<any>,
    sceneManager: Systems.SceneManager<TContext>,
    options: RuntimeOptions<TContext>
  ) {
    this.canvas = canvas;
    this.world = new Systems.World<THREE.WebGPURenderer, TContext>(renderer, {
      enableOnExit: true,
      sceneManager,
      context: options.context,
      audio: options.audio
    });
    this.world.setLoadingManager(this.manager);

    if (options.includePerformanceStats) {
      this.stats = new Stats();
      this.stats.showPanel(0);
      this.stats.dom.removeAttribute("style");
      this.stats.dom.classList.add("stats");
    }
  }

  /**
   * Builds a `Runtime`. `ThreeRenderer` requires an asynchronous `init()`
   * before first use (see `ThreeRenderer.create`), so `Runtime` construction
   * is async too.
   */
  static async create<
    TContext = Systems.WorldDefaultContext
  >(
    canvas: HTMLCanvasElement,
    options: RuntimeOptions<TContext> = Object.create(null)
  ): Promise<Runtime<TContext>> {
    if (!canvas) {
      throw new Error("Canvas element is required to create a Runtime instance.");
    }

    const sceneManager = new Systems.SceneManager<TContext>();
    const renderer: Systems.Renderer<any> = await Systems.ThreeRenderer.create(
      canvas,
      {
        sceneManager,
        renderMode: "direct"
      }
    );

    return new Runtime(canvas, renderer, sceneManager, options);
  }

  get running() {
    return this.#isRunning;
  }

  preloadAssets() {
    return this.world.preloadSceneAssets();
  }

  start() {
    if (this.#isRunning) {
      return;
    }

    this.#isRunning = true;
    this.canvas.focus();

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
