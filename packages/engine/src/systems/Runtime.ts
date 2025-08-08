// Import Third-party Dependencies
import Stats from "stats.js";
import * as THREE from "three";

// Import Internal Dependencies
import { Assets } from "../systems/index.js";
import { GameInstance } from "./GameInstance.js";
import { GameInstanceDefaultLoader } from "../systems/Loader.js";

export interface RuntimeOptions {
  /**
   * @default false
   * Whether to include performance statistics (eg: FPS, memory usage).
   */
  includePerformanceStats?: boolean;
}

export class Runtime {
  gameInstance: GameInstance;
  canvas: HTMLCanvasElement;
  stats?: Stats;
  manager = new THREE.LoadingManager();

  accumulatedTime: number;
  lastTimestamp: number;
  tickAnimationFrameId: number;
  targetFrameTime: number;

  #isRunning = false;

  constructor(
    canvas: HTMLCanvasElement,
    options: RuntimeOptions = {}
  ) {
    if (!canvas) {
      throw new Error("Canvas element is required to create a Runtime instance.");
    }

    this.canvas = canvas;
    this.gameInstance = new GameInstance(canvas, {
      enableOnExit: true,
      loader: new GameInstanceDefaultLoader(this.manager)
    });

    this.targetFrameTime = 1000 / this.gameInstance.framesPerSecond;

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

    this.lastTimestamp = 0;
    this.accumulatedTime = 0;

    Assets.loadAll({ manager: this.manager }).then(() => {
      this.gameInstance.connect();
      this.tick();
    }).catch(console.error);
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

    this.accumulatedTime += timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    const {
      updates, timeLeft
    } = this.gameInstance.tick(this.accumulatedTime);
    this.accumulatedTime = timeLeft;
    if (this.gameInstance.input.exited) {
      this.stop();

      return;
    }

    if (updates > 0) {
      this.gameInstance.draw();
    }

    this.stats?.end();
    this.tickAnimationFrameId = requestAnimationFrame(this.tick);
  };
}
