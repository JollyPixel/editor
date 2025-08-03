// Import Third-party Dependencies
import Stats from "stats.js";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

// Import Internal Dependencies
import { GameInstance } from "./GameInstance.js";

export interface RuntimeOptions {
  /**
   * @default false
   * Whether to include performance statistics (eg: FPS, memory usage).
   */
  includePerformanceStats?: boolean;
  /**
   * @default 50
   * Maximum delta time in milliseconds to prevent large jumps in time.
   * This is useful to avoid issues with large frame drops or when the game is paused.
   */
  maxDeltaTime?: number;
}

export class Runtime {
  gameInstance: GameInstance;
  canvas: HTMLCanvasElement;
  stats?: Stats;
  manager = new THREE.LoadingManager();

  accumulatedTime: number;
  lastTimestamp: number;
  tickAnimationFrameId: number;
  maxDeltaTime: number;
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
      loader: {
        audio: new THREE.AudioLoader(this.manager),
        objLoader: new OBJLoader(this.manager),
        mtlLoader: new MTLLoader(this.manager)
      }
    });

    this.maxDeltaTime = options.maxDeltaTime ?? 50;
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
    this.gameInstance.connect();

    if (this.stats) {
      document.body.appendChild(this.stats.dom);
    }

    this.lastTimestamp = 0;
    this.accumulatedTime = 0;

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

    this.accumulatedTime += timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    // if (deltaTime >= this.targetFrameTime) {
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
    // }

    this.stats?.end();
    this.tickAnimationFrameId = requestAnimationFrame(this.tick);
  };
}
