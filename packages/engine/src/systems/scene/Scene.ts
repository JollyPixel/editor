/* eslint-disable no-empty-function */
// Import Third-party Dependencies
import {
  AssetReference,
  type AssetReferenceGroup
} from "@jolly-pixel/asset";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { World, WorldDefaultContext } from "../World.ts";
import { IntegerIncrement } from "../generators/IntegerIncrement.ts";
import type { Logger } from "../Logger.ts";

export type SceneAssetDeclaration =
  | AssetReference<unknown>
  | AssetReferenceGroup;

export interface SceneOptions {
  assets?: Iterable<SceneAssetDeclaration>;
}

export type SceneLifecycleEvents = {
  awake: () => void;
  start: () => void;
  destroy: () => void;
};

/**
 * Declares scene dependencies and provides synchronous ECS lifecycle hooks.
 */
export abstract class Scene<
  TContext = WorldDefaultContext
> extends Emitter<SceneLifecycleEvents> {
  static readonly Id = new IntegerIncrement();

  readonly id: number;
  readonly name: string;
  readonly assets: readonly AssetReference<unknown>[];

  /** Set by SceneManager when the scene is activated. */
  world!: World<any, TContext>;

  #logger: Logger | undefined;

  constructor(
    name: string,
    options: SceneOptions = {}
  ) {
    super();
    this.id = Scene.Id.incr();
    this.name = name;
    this.assets = parseSceneAssets(options.assets ?? []);
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
   * Called once when the scene is first activated (before the first start/update).
   * Populate actors here.
   */
  awake(): void { }

  /**
   * Called once at the beginning of the first frame after awake.
   * Useful for cross-actor initialization that requires all awake() calls to have run.
   */
  start(): void { }

  /**
   * Runs per rendered frame with interpolation `alpha` in [0, 1).
   */
  update(
    _deltaTime: number,
    _alpha?: number
  ): void { }

  /**
   * Runs per fixed step. `stepIndex` starts at zero for each frame.
   */
  fixedUpdate(
    _deltaTime: number,
    _stepIndex?: number
  ): void { }

  /**
   * Called when the scene is being replaced or explicitly unloaded.
   * Clean up timers, subscriptions, etc. Actor destruction is handled
   * automatically by SceneManager.
   */
  destroy(): void { }
}

function parseSceneAssets(
  declarations: Iterable<SceneAssetDeclaration>
): readonly AssetReference<unknown>[] {
  const references: AssetReference<unknown>[] = [];

  for (const declaration of declarations) {
    if (declaration instanceof AssetReference) {
      references.push(declaration);
    }
    else {
      references.push(...Object.values(declaration));
    }
  }

  return Object.freeze(references);
}
