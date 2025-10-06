// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type GameRenderer
} from "./rendering/index.js";
import {
  type Scene
} from "./Scene.js";
import {
  FixedTimeStep,
  type TimerAdapter
} from "./FixedTimeStep.js";
import { Input } from "../controls/Input.class.js";
import { GlobalAudio } from "../audio/GlobalAudio.js";
import {
  type WindowAdapter,
  BrowserWindowAdapter
} from "../adapters/window.js";
import {
  type GlobalsAdapter,
  BrowserGlobalsAdapter
} from "../adapters/global.js";

export interface GameInstanceOptions {
  enableOnExit?: boolean;

  scene: Scene;
  input?: Input;
  scheduler?: FixedTimeStep;
  audio?: GlobalAudio;
  clock?: TimerAdapter;

  windowAdapter?: WindowAdapter;
  globalsAdapter?: GlobalsAdapter;
}

export class GameInstance<T = THREE.WebGLRenderer> {
  renderer: GameRenderer<T>;
  input: Input;
  loadingManager: THREE.LoadingManager = new THREE.LoadingManager();
  scheduler: FixedTimeStep;
  scene: Scene;
  audio: GlobalAudio;

  accumulatedTime = 0;
  lastTimestamp = 0;

  #windowAdapter: WindowAdapter;

  constructor(
    renderer: GameRenderer<T>,
    options: GameInstanceOptions
  ) {
    const {
      scene,
      input = new Input(renderer.canvas, { enableOnExit: options.enableOnExit ?? false }),
      scheduler = new FixedTimeStep(options.clock),
      audio = new GlobalAudio(),
      windowAdapter = new BrowserWindowAdapter(),
      globalsAdapter = new BrowserGlobalsAdapter()
    } = options;

    this.renderer = renderer as unknown as GameRenderer<T>;
    this.scene = scene;
    this.input = input;
    this.audio = audio;
    this.scheduler = scheduler;
    this.#windowAdapter = windowAdapter;

    globalsAdapter.setGame(this);
  }

  setLoadingManager(
    manager: THREE.LoadingManager
  ) {
    this.loadingManager = manager;

    return this;
  }

  connect() {
    this.input.connect();
    this.#windowAdapter.addEventListener("resize", this.renderer.resize);
    this.scene.awake();

    return this;
  }

  disconnect() {
    this.input.disconnect();
    this.#windowAdapter.removeEventListener("resize", this.renderer.resize);

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

    updates > 0 && this.renderer.draw();

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
