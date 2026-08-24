// Import Third-party Dependencies
import type { AssetCoordinator } from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";
import { Input } from "@jolly-pixel/controls";
import type { FrameSchedule } from "@jolly-pixel/loop";
import { Emitter } from "@openally/emitt";

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
} from "./scene/SceneManager.ts";
import { GlobalAudio } from "../audio/GlobalAudio.ts";
import {
  type GlobalsAdapter,
  BrowserGlobalsAdapter
} from "../adapters/global.ts";
import {
  Logger,
  type LoggerOptions
} from "./Logger.ts";

export type WorldEvents = {
  beforeFixedUpdate: (dt: number) => void;
  afterFixedUpdate: (dt: number) => void;
  beforeUpdate: (dt: number) => void;
  afterUpdate: (dt: number) => void;
};

export interface WorldOptions<
  TContext = WorldDefaultContext
> {
  enableOnExit?: boolean;
  /**
   * Enables debug mode. When true, the logger is pre-configured with level "trace"
   * and all namespaces enabled ("*"), unless overridden by the `logger` option.
   */
  debug?: boolean;
  /**
   * Logger configuration. Individual options override the defaults derived from `debug`.
   */
  logger?: LoggerOptions;

  sceneManager: SceneManager<TContext>;
  input?: Input;
  audio?: GlobalAudio;
  context?: TContext;
  assetCoordinator: AssetCoordinator;

  globalsAdapter?: GlobalsAdapter;
}

export interface WorldDefaultContext {
  [key: string]: unknown;
}

/**
 * Owns synchronous engine systems and their shared runtime context.
 */
export class World<
  T = THREE.WebGPURenderer,
  TContext = WorldDefaultContext
> extends Emitter<WorldEvents> {
  renderer: Renderer<T>;
  input: Input;
  sceneManager: SceneManager<TContext>;
  audio: GlobalAudio;
  context: TContext;
  assetCoordinator: AssetCoordinator;

  readonly debug: boolean;
  readonly logger: Logger;

  #worldLogger: Logger;
  #running = false;

  constructor(
    renderer: Renderer<T>,
    options: WorldOptions<TContext>
  ) {
    super();

    const {
      sceneManager,
      input = new Input(
        renderer.canvas,
        { enableOnExit: options.enableOnExit ?? false }
      ),
      audio = new GlobalAudio(),
      context = Object.create(null),
      globalsAdapter = new BrowserGlobalsAdapter(),
      assetCoordinator
    } = options;

    this.debug = options.debug ?? false;
    this.logger = new Logger({
      level: this.debug ?
        "trace" :
        (options.logger?.level ?? "info"),
      namespaces: this.debug ?
        ["*"] :
        (options.logger?.namespaces ?? []),
      adapter: options.logger?.adapter
    });
    this.#worldLogger = this.logger.child({
      namespace: "Systems.World"
    });

    this.renderer = renderer;
    this.sceneManager = sceneManager;
    this.input = input;
    this.audio = audio;
    this.context = context;
    this.assetCoordinator = assetCoordinator;

    sceneManager.bindWorld(this);
    globalsAdapter.setGame(this);
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
    this.#worldLogger.debug("Connecting world");

    this.input.connect();
    this.renderer.observeResize();
    this.sceneManager.awake();

    return this;
  }

  disconnect() {
    this.#worldLogger.debug("Disconnecting world");

    this.input.disconnect();
    this.renderer.unobserveResize();

    return this;
  }

  get running(): boolean {
    return this.#running;
  }

  start() {
    this.#worldLogger.debug("Starting world");
    this.#running = true;

    return this;
  }

  stop() {
    this.#worldLogger.debug("Stopping world");
    this.#running = false;

    return this;
  }

  /**
   * Stops the loop, disconnects, and releases the renderer's GPU resources.
   * The world must not be used afterwards — browsers cap the number of live
   * WebGL contexts, so a world that is dropped without disposing leaks one.
   */
  dispose() {
    this.#worldLogger.debug("Disposing world");

    this.stop();
    this.disconnect();
    this.renderer.dispose();

    return this;
  }

  tick(
    schedule: FrameSchedule
  ): boolean {
    if (!this.#running) {
      return false;
    }

    this.sceneManager.beginFrame();

    const fixedDt = schedule.fixedDelta / 1000;
    for (let stepIndex = 0; stepIndex < schedule.steps; stepIndex++) {
      this.input.update();

      this.emit(
        "beforeFixedUpdate",
        fixedDt
      );
      this.sceneManager.fixedUpdate(
        fixedDt,
        stepIndex
      );
      this.emit(
        "afterFixedUpdate",
        fixedDt
      );
    }
    if (schedule.steps === 0) {
      this.input.update();
    }

    if (schedule.render) {
      const dt = schedule.frameDelta / 1000;

      this.emit(
        "beforeUpdate",
        dt
      );
      this.sceneManager.update(
        dt,
        schedule.alpha
      );
      this.renderer.draw();
      this.emit(
        "afterUpdate",
        dt
      );
    }

    return this.#endFrame();
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
