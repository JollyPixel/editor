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

export abstract class Scene<
  TContext = WorldDefaultContext
> extends Emitter<SceneLifecycleEvents> {
  static readonly Id = new IntegerIncrement();

  readonly id: number;
  readonly name: string;
  readonly assets: readonly AssetReference<unknown>[];

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

  get logger(): Logger {
    this.#logger ??= this.world.logger.child({
      namespace: `Scene.${this.name}`
    });

    return this.#logger;
  }

  awake(): void { }

  start(): void { }

  update(
    _deltaTime: number,
    _alpha?: number
  ): void { }

  fixedUpdate(
    _deltaTime: number,
    _stepIndex?: number
  ): void { }

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
