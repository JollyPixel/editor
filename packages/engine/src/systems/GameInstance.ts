// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  type Renderer
} from "./rendering/index.ts";
import {
  Actor,
  type ActorOptions
} from "../actor/index.ts";
import {
  type Scene
} from "./Scene.ts";
import { Input } from "../controls/Input.class.ts";
import { GlobalAudio } from "../audio/GlobalAudio.ts";
import {
  type WindowAdapter,
  BrowserWindowAdapter
} from "../adapters/window.ts";
import {
  type GlobalsAdapter,
  BrowserGlobalsAdapter
} from "../adapters/global.ts";

export interface GameInstanceOptions<TContext = Record<string, unknown>> {
  enableOnExit?: boolean;

  scene: Scene;
  input?: Input;
  audio?: GlobalAudio;
  context?: TContext;

  windowAdapter?: WindowAdapter;
  globalsAdapter?: GlobalsAdapter;
}

export class GameInstance<T = THREE.WebGLRenderer, TContext = Record<string, unknown>> {
  renderer: Renderer<T>;
  input: Input;
  loadingManager: THREE.LoadingManager = new THREE.LoadingManager();
  scene: Scene;
  audio: GlobalAudio;
  context: TContext;

  #windowAdapter: WindowAdapter;

  constructor(
    renderer: Renderer<T>,
    options: GameInstanceOptions<TContext>
  ) {
    const {
      scene,
      input = new Input(renderer.canvas, { enableOnExit: options.enableOnExit ?? false }),
      audio = new GlobalAudio(),
      context = {} as TContext,
      windowAdapter = new BrowserWindowAdapter(),
      globalsAdapter = new BrowserGlobalsAdapter()
    } = options;

    this.renderer = renderer;
    this.scene = scene;
    this.input = input;
    this.audio = audio;
    this.context = context;
    this.#windowAdapter = windowAdapter;

    globalsAdapter.setGame(this);
  }

  setLoadingManager(
    manager: THREE.LoadingManager
  ) {
    this.loadingManager = manager;

    return this;
  }

  createActor(
    name: string,
    options: Omit<ActorOptions<TContext>, "name"> = {}
  ): Actor<TContext> {
    return new Actor<TContext>(this, {
      name,
      ...options
    });
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
    deltaTime: number
  ): boolean {
    this.input.update();
    this.scene.update(deltaTime);

    if (this.input.exited) {
      this.renderer.clear();

      return true;
    }

    return false;
  }

  render() {
    this.renderer.draw();
  }
}
