// Import Third-party Dependencies
import {
  AssetReference,
  type AssetCatalog,
  type AssetRecord
} from "@jolly-pixel/asset";
import {
  SceneFileAssetType,
  Systems
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  GameScenes,
  type SceneFileSource
} from "./GameScenes.ts";

// CONSTANTS
const kSceneKind = SceneFileAssetType.kind;

export interface PlayerPhysics {
  uses: (component: Readonly<Systems.SceneComponentFile>) => boolean;
  attach: () => Promise<void>;
}

export interface PlayerScenesOptions {
  files: SceneFileSource;
  catalog: AssetCatalog;
  components: Systems.ComponentDefinitions;
  physics: PlayerPhysics;
}

export class PlayerScenes implements Systems.SceneSource {
  #files: GameScenes;
  #catalog: AssetCatalog;
  #components: Systems.ComponentDefinitions;
  #physics: PlayerPhysics;
  #attached: Promise<void> | null = null;

  constructor(
    options: PlayerScenesOptions
  ) {
    this.#files = new GameScenes(options.files);
    this.#catalog = options.catalog;
    this.#components = options.components;
    this.#physics = options.physics;
  }

  scene(
    ref: string
  ): Systems.FileScene {
    const record = this.#record(ref);
    const sceneId = record.id.value;

    return new Systems.FileScene(
      record.path.name,
      () => this.#load(sceneId),
      {
        components: this.#components,
        prefabs: this.#files,
        sceneId
      }
    );
  }

  async #load(
    sceneId: string
  ): Promise<Systems.SceneFile> {
    const file = await this.#files.load(sceneId);
    if (this.#files.uses(sceneId, this.#physics.uses)) {
      await this.#attachPhysics();
    }

    return file;
  }

  #attachPhysics(): Promise<void> {
    this.#attached ??= this.#physics.attach().catch((error: unknown) => {
      this.#attached = null;
      throw error;
    });

    return this.#attached;
  }

  #record(
    ref: string
  ): AssetRecord {
    if (this.#catalog.has(ref)) {
      return this.#catalog.resolve(new AssetReference(ref, SceneFileAssetType));
    }

    for (const record of this.#catalog.byKind(kSceneKind)) {
      const { path } = record;
      if (path.value === ref || path.withoutExtension().value === ref) {
        return record;
      }
    }

    throw new Error(`No scene "${ref}" in this game.`);
  }
}
