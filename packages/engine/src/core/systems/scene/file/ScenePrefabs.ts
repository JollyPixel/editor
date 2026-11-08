// Import Internal Dependencies
import { PrefabOverrides } from "./PrefabOverrides.ts";
import type {
  SceneActorFile,
  SceneFile
} from "./SceneFile.ts";

export type ScenePrefabFile = Pick<SceneFile, "actors">;

export interface ScenePrefabs {
  find(
    sceneId: string
  ): Readonly<ScenePrefabFile> | null;
}

export const NO_SCENE_PREFABS: ScenePrefabs = {
  find: () => null
};

export function expandedSceneActors(
  actors: Iterable<SceneActorFile>,
  prefabs: ScenePrefabs,
  sceneId?: string
): IterableIterator<SceneActorFile> {
  return expand(actors, prefabs, sceneId === undefined ? [] : [sceneId]);
}

function* expand(
  actors: Iterable<SceneActorFile>,
  prefabs: ScenePrefabs,
  chain: readonly string[]
): IterableIterator<SceneActorFile> {
  for (const actor of actors) {
    yield actor;

    const { prefab } = actor;
    if (prefab === undefined || chain.includes(prefab.id)) {
      continue;
    }

    const scene = prefabs.find(prefab.id);
    if (scene !== null) {
      const overrides = PrefabOverrides.from(actor.overrides);
      yield* expand(
        scene.actors.map((file) => overrides.scope(file, actor.id)),
        prefabs,
        [...chain, prefab.id]
      );
    }
  }
}
