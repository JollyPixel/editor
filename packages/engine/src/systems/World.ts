// Import Third-party Dependencies
import * as THREE from "three";
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import {
  type Renderer
} from "./rendering/index.ts";
import {
  Actor,
  type ActorOptions
} from "../actor/index.ts";
import {
  type SceneManager
} from "./SceneManager.ts";
import { Input } from "../controls/Input.class.ts";
import { GlobalAudio } from "../audio/GlobalAudio.ts";
import {
  type GlobalsAdapter,
  BrowserGlobalsAdapter
} from "../adapters/global.ts";
import { FixedTimeStep } from "./FixedTimeStep.ts";

export type WorldEvents = {
  beforeFixedUpdate: [number];
  afterFixedUpdate: [number];
  beforeUpdate: [number];
  afterUpdate: [number];
};

export interface WorldOptions<
  TContext = WorldDefaultContext
> {
  enableOnExit?: boolean;

  sceneManager: SceneManager<TContext>;
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
> extends EventEmitter<WorldEvents> {
  renderer: Renderer<T>;
  input: Input;
  loadingManager: THREE.LoadingManager = new THREE.LoadingManager();
  sceneManager: SceneManager<TContext>;
  audio: GlobalAudio;
  context: TContext;
  loop: FixedTimeStep;

  constructor(
    renderer: Renderer<T>,
    options: WorldOptions<TContext>
  ) {
    super();

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
    this.loop = new FixedTimeStep();

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

  start() {
    this.loop.start();

    return this;
  }

  stop() {
    this.loop.stop();

    return this;
  }

  setFps(
    fps: number,
    fixedFps?: number
  ) {
    this.loop.setFps(fps, fixedFps);

    return this;
  }

  tick() {
    this.#beginFrame();
    this.loop.tick({
      fixedUpdate: (fixedDelta) => {
        const dt = fixedDelta / 1000;
        this.emit("beforeFixedUpdate", dt);
        this.sceneManager.fixedUpdate(dt);
        this.emit("afterFixedUpdate", dt);
      },
      update: (_interpolation, delta) => {
        const dt = delta / 1000;
        this.emit("beforeUpdate", dt);
        this.sceneManager.update(dt);
        this.renderer.draw();
        this.emit("afterUpdate", dt);
      }
    });

    return this.#endFrame();
  }

  #beginFrame() {
    this.input.update();
    this.sceneManager.beginFrame();
  }

  #endFrame(): boolean {
    this.sceneManager.endFrame();

    if (this.input.exited) {
      this.renderer.clear();

      return true;
    }

    return false;
  }
}
