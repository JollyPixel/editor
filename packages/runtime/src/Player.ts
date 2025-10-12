// Import Third-party Dependencies
import Stats from "stats.js";
import * as THREE from "three";
import {
  Systems
} from "@jolly-pixel/engine";

export interface PlayerOptions {
  /**
   * @default false
   * Whether to include performance statistics (eg: FPS, memory usage).
   */
  includePerformanceStats?: boolean;
}

export class Player {
  gameInstance: Systems.GameInstance;
  canvas: HTMLCanvasElement;
  stats?: Stats;
  clock = new THREE.Clock();
  manager = new THREE.LoadingManager();

  framesPerSecond = 60;

  #isRunning = false;
  #deltaTime = 0;

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
    ) as unknown as Systems.GameRenderer<THREE.WebGLRenderer>;
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
    const renderer = this.gameInstance.renderer.getSource();
    renderer.setAnimationLoop(this.tick);
  }

  stop() {
    if (!this.#isRunning) {
      return;
    }

    this.#isRunning = false;
    this.gameInstance.input.exited = true;
    const renderer = this.gameInstance.renderer.getSource();
    renderer.setAnimationLoop(null);

    this.gameInstance.disconnect();
  }

  setFps(
    framesPerSecond: number | undefined
  ): void {
    if (!framesPerSecond) {
      return;
    }

    this.framesPerSecond = THREE.MathUtils.clamp(
      framesPerSecond,
      1,
      60
    );
  }

  tick = () => {
    this.#deltaTime += this.clock.getDelta();

    const interval = 1 / this.framesPerSecond;
    if (this.#deltaTime >= interval) {
      this.stats?.begin();
      const exit = this.gameInstance.update(this.#deltaTime);
      if (exit) {
        this.stop();

        return;
      }

      this.gameInstance.render();

      this.#deltaTime %= interval;
      this.stats?.end();
    }
  };
}
