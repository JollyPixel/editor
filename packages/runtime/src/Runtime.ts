// Import Third-party Dependencies
import Stats from "stats.js";
import * as THREE from "three";

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
  world: Systems.World<THREE.WebGLRenderer, TContext>;

  canvas: HTMLCanvasElement;
  stats?: Stats;
  manager = new THREE.LoadingManager();

  #isRunning = false;

  constructor(
    canvas: HTMLCanvasElement,
    options: RuntimeOptions<TContext> = Object.create(null)
  ) {
    if (!canvas) {
      throw new Error("Canvas element is required to create a Runtime instance.");
    }

    this.canvas = canvas;
    const sceneManager = new Systems.SceneManager();
    const renderer: Systems.Renderer<any> = new Systems.ThreeRenderer(
      canvas,
      {
        sceneManager,
        renderMode: "direct"
      }
    );
    this.world = new Systems.World(renderer, {
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

  get running() {
    return this.#isRunning;
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
}
