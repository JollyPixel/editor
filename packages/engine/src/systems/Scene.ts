/* eslint-disable no-empty-function */
// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import type { World, WorldDefaultContext } from "./World.ts";
import { IntegerIncrement } from "./generators/IntegerIncrement.ts";
import type { Logger } from "./Logger.ts";
import type { ComponentInitializeContext } from "../components/types.ts";

export type SceneLifecycleEvents = {
  initialize: [];
  awake: [];
  start: [];
  destroy: [];
};

export abstract class Scene<
  TContext = WorldDefaultContext
> extends EventEmitter<SceneLifecycleEvents> {
  static readonly Id = new IntegerIncrement();

  readonly id: number;
  readonly name: string;

  /** Set by SceneManager when the scene is activated. */
  world!: World<any, TContext>;

  #logger: Logger | undefined;

  constructor(name: string) {
    super();
    this.id = Scene.Id.incr();
    this.name = name;
  }

  /**
   * A child logger scoped to this scene's namespace (`scenes.<name>`).
   * Created lazily on first access; safe to use from `awake()` onwards.
   */
  get logger(): Logger {
    this.#logger ??= this.world.logger.child({
      namespace: `Scene.${this.name}`
    });

    return this.#logger;
  }

  /**
   * Called once before awake(), asynchronously. Use this to declare asset dependencies
   * via context.assetManager.load(). All declared assets will be fully loaded before
   * awake() is called.
   */
  async initialize(_context: ComponentInitializeContext): Promise<void> {}

  /**
   * Called once when the scene is first activated (before the first start/update).
   * Populate actors here.
   */
  awake(): void {}

  /**
   * Called once at the beginning of the first frame after awake.
   * Useful for cross-actor initialization that requires all awake() calls to have run.
   */
  start(): void {}

  /**
   * Called every frame (variable rate).
   */
  update(_deltaTime: number): void {}

  /**
   * Called every fixed step (deterministic rate).
   */
  fixedUpdate(_deltaTime: number): void {}

  /**
   * Called when the scene is being replaced or explicitly unloaded.
   * Clean up timers, subscriptions, etc. Actor destruction is handled
   * automatically by SceneManager.
   */
  destroy(): void {}
}
