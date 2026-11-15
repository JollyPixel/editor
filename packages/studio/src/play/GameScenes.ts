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
  #source: SceneFileSource;
  #files = new Map<string, Systems.SceneFile>();

  constructor(
    source: SceneFileSource
  ) {
    this.#source = source;
  }

  async load(
    sceneId: string
  ): Promise<Systems.SceneFile> {
    const visited = new Set<string>();
    const visit = async(id: string): Promise<void> => {
      if (visited.has(id)) {
        return;
      }
      visited.add(id);

      const file = await this.#source.load(
        new AssetReference(id, SceneFileAssetType)
      );
      this.#files.set(id, file);
      await Promise.all(file.actors.flatMap(
        ({ prefab }) => (prefab?.kind === kSceneKind ? [visit(prefab.id)] : [])
      ));
    };

    await visit(sceneId);

    return this.#loaded(sceneId);
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
