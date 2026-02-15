// Import Third-party Dependencies
import Stats from "stats.js";
import * as THREE from "three";

// Import Internal Dependencies
import { Systems } from "@jolly-pixel/engine";

export interface PlayerOptions {
  /**
   * @default false
   * Whether to include performance statistics (eg: FPS, memory usage).
   */
  includePerformanceStats?: boolean;
}

export class Player {
  gameInstance: Systems.GameInstance;
  loop = new Systems.FixedTimeStep();

  canvas: HTMLCanvasElement;
  stats?: Stats;
  manager = new THREE.LoadingManager();

  #isRunning = false;

  constructor(
    canvas: HTMLCanvasElement,
    options: PlayerOptions = {}
  ) {
    if (!canvas) {
      throw new Error("Canvas element is required to create a Runtime instance.");
    }

    this.canvas = canvas;
    const scene = new Systems.SceneEngine();
    const renderer = new Systems.ThreeRenderer(
      canvas, { scene, renderMode: "direct" }
    ) as unknown as Systems.Renderer<THREE.WebGLRenderer>;
    this.gameInstance = new Systems.GameInstance(renderer, {
      enableOnExit: true,
      scene
    });
    this.gameInstance.setLoadingManager(this.manager);

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

    this.gameInstance.connect();
    this.loop.start();
    const renderer = this.gameInstance.renderer.getSource();
    renderer.setAnimationLoop(() => {
      this.loop.tick({
        fixedUpdate: (fixedDelta) => {
          // fixedDelta is in ms, but gameInstance.update expects seconds
          const exit = this.gameInstance.update(fixedDelta / 1000);
          if (exit) {
            this.stop();
          }
        },
        update: (_interpolation, _delta) => {
          this.stats?.begin();
          this.gameInstance.render();
          this.stats?.end();
        }
      });
    });
  }

  stop() {
    if (!this.#isRunning) {
      return;
    }

    this.#isRunning = false;
    this.loop.stop();
    this.gameInstance.input.exited = true;
    const renderer = this.gameInstance.renderer.getSource();
    renderer.setAnimationLoop(null);

    this.gameInstance.disconnect();
  }
}
