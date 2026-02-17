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
  type SceneContract
} from "./SceneManager.ts";
import { Input } from "../controls/Input.class.ts";
import { GlobalAudio } from "../audio/GlobalAudio.ts";
import {
  type GlobalsAdapter,
  BrowserGlobalsAdapter
} from "../adapters/global.ts";

export interface WorldOptions<
  TContext = WorldDefaultContext
> {
  enableOnExit?: boolean;

  sceneManager: SceneContract;
  input?: Input;
  audio?: GlobalAudio;
  context?: TContext;

  globalsAdapter?: GlobalsAdapter;
}

export interface WorldDefaultContext {
  [key: string]: unknown;
}

export class World<
  T = THREE.WebGLRenderer,
  TContext = WorldDefaultContext
> {
  renderer: Renderer<T>;
  input: Input;
  loadingManager: THREE.LoadingManager = new THREE.LoadingManager();
  sceneManager: SceneContract;
  audio: GlobalAudio;
  context: TContext;

  constructor(
    renderer: Renderer<T>,
    options: WorldOptions<TContext>
  ) {
    const {
      sceneManager,
      input = new Input(renderer.canvas, { enableOnExit: options.enableOnExit ?? false }),
      audio = new GlobalAudio(),
      context = Object.create(null),
      globalsAdapter = new BrowserGlobalsAdapter()
    } = options;

    this.renderer = renderer;
    this.sceneManager = sceneManager;
    this.input = input;
    this.audio = audio;
    this.context = context;

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
    this.renderer.observeResize();
    this.sceneManager.awake();

    return this;
  }

  disconnect() {
    this.input.disconnect();
    this.renderer.unobserveResize();

    return this;
  }

  beginFrame() {
    this.input.update();
    this.sceneManager.beginFrame();
  }

  fixedUpdate(
    deltaTime: number
  ) {
    this.sceneManager.fixedUpdate(deltaTime);
  }

  update(
    deltaTime: number
  ) {
    this.sceneManager.update(deltaTime);
  }

  endFrame(): boolean {
    this.sceneManager.endFrame();

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
