// Import Third-party Dependencies
import { AssetReference } from "@jolly-pixel/asset";
import {
  SceneFileAssetType,
  Systems
} from "@jolly-pixel/engine";

// CONSTANTS
const kSceneKind = SceneFileAssetType.kind.value;

export interface SceneFileSource {
  load(
    reference: AssetReference<Systems.SceneFile>
  ): Promise<Systems.SceneFile>;
}

export class GameScenes implements Systems.ScenePrefabs {
  static async load(
    source: SceneFileSource,
    start: string
  ): Promise<GameScenes> {
    const started = new Set<string>();
    const files = new Map<string, Systems.SceneFile>();

    async function visit(
      sceneId: string
    ): Promise<void> {
      if (started.has(sceneId)) {
        return;
      }
      started.add(sceneId);

      const file = await source.load(
        new AssetReference(sceneId, SceneFileAssetType)
      );
      files.set(sceneId, file);
      await Promise.all(file.actors.flatMap(
        ({ prefab }) => (prefab?.kind === kSceneKind ? [visit(prefab.id)] : [])
      ));
    }

    await visit(start);

    return new GameScenes(files);
  }

  #files: ReadonlyMap<string, Systems.SceneFile>;

  constructor(
    files: ReadonlyMap<string, Systems.SceneFile>
  ) {
    this.#files = files;
  }

  find(
    sceneId: string
  ): Systems.SceneFile | null {
    return this.#files.get(sceneId) ?? null;
  }

  uses(
    sceneId: string,
    predicate: (component: Readonly<Systems.SceneComponentFile>) => boolean
  ): boolean {
    const actors = Systems.expandedSceneActors(
      this.#loaded(sceneId).actors,
      this,
      sceneId
    );
    for (const actor of actors) {
      if (actor.components.some(predicate)) {
        return true;
      }
    }

    return false;
  }

  scene(
    sceneId: string,
    name: string,
    components: Systems.ComponentDefinitions
  ): Systems.FileScene {
    return new Systems.FileScene(name, this.#loaded(sceneId), {
      components,
      prefabs: this,
      sceneId
    });
  }

  #loaded(
    sceneId: string
  ): Systems.SceneFile {
    const file = this.find(sceneId);
    if (file === null) {
      throw new Error(`Scene "${sceneId}" was not loaded.`);
    }

    return file;
  }
}
