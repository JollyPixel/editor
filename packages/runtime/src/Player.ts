// Import Third-party Dependencies
import Stats from "stats.js";
import * as THREE from "three";
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
  canvas: HTMLCanvasElement;
  stats?: Stats;
  manager = new THREE.LoadingManager();

  tickAnimationFrameId: number;

  #isRunning = false;

  constructor(
    canvas: HTMLCanvasElement,
    options: PlayerOptions = {}
  ) {
    if (!canvas) {
      throw new Error("Canvas element is required to create a Runtime instance.");
    }

    this.canvas = canvas;
    const renderer = new Systems.ThreeRenderer(
      canvas
    ) as unknown as Systems.GameRenderer<THREE.WebGLRenderer>;
    this.gameInstance = new Systems.GameInstance(renderer, {
      enableOnExit: true,
      loadingManager: this.manager
    });

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
    this.tick();
  }

  stop() {
    if (!this.#isRunning) {
      return;
    }

    this.gameInstance.input.exited = true;

    if (this.tickAnimationFrameId) {
      cancelAnimationFrame(this.tickAnimationFrameId);
      this.tickAnimationFrameId = 0;
    }

    this.gameInstance.disconnect();
  }

  tick = (timestamp = performance.now()) => {
    if (!this.#isRunning) {
      return;
    }
    this.stats?.begin();

    const exit = this.gameInstance.update(timestamp);
    if (exit) {
      this.stop();

      return;
    }

    this.stats?.end();
    this.tickAnimationFrameId = requestAnimationFrame(this.tick);
  };
}
