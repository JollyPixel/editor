// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type GameRenderer,
  ThreeRenderer
} from "./Renderers/index.js";
import {
  SceneEngine,
  type Scene
} from "./Scene.js";
import { FixedTimeStep } from "./FixedTimeStep.js";
import { Input } from "../controls/Input.class.js";
import { GlobalAudio } from "../audio/GlobalAudio.js";

export interface GameInstanceOptions<T = THREE.WebGLRenderer> {
  enableOnExit?: boolean;
  loadingManager?: THREE.LoadingManager;

  scene?: Scene;
  renderer?: GameRenderer<T>;
  input?: Input;
}

export class GameInstance<T = THREE.WebGLRenderer> {
  canvas: HTMLCanvasElement;
  renderer: GameRenderer<T>;
  input: Input;
  loadingManager: THREE.LoadingManager;
  scheduler = new FixedTimeStep();
  scene: Scene;
  audio = new GlobalAudio();

  accumulatedTime = 0;
  lastTimestamp = 0;

  constructor(
    canvas: HTMLCanvasElement,
    options: GameInstanceOptions = {}
  ) {
    const {
      loadingManager = new THREE.LoadingManager(),
      scene = new SceneEngine(),
      renderer = new ThreeRenderer(canvas),
      input = new Input(canvas, { enableOnExit: options.enableOnExit ?? false })
    } = options;
    globalThis.game = this;

    this.loadingManager = loadingManager;
    this.renderer = renderer as unknown as GameRenderer<T>;
    this.scene = scene;
    this.input = input;
    this.canvas = canvas;
  }

  connect() {
    this.input.connect();
    window.addEventListener("resize", this.renderer.resize);
    this.scene.awake();

    return this;
  }

  disconnect() {
    this.input.disconnect();
    window.removeEventListener("resize", this.renderer.resize);

    return this;
  }

  update(
    timestamp: number
  ): boolean {
    this.accumulatedTime += timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    const {
      updates, timeLeft
    } = this.scheduler.tick(
      this.accumulatedTime,
      this.tick
    );
    this.accumulatedTime = timeLeft;
    if (this.input.exited) {
      return true;
    }

    if (updates > 0) {
      this.renderer.draw(this.scene);
    }

    return false;
  }

  private tick = (deltaTime: number) => {
    this.input.update();
    this.scene.update(deltaTime);

    if (this.input.exited) {
      this.renderer.clear();

      return true;
    }

    return false;
  };
}
