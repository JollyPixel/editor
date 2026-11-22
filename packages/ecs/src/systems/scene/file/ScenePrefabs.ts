// Import Internal Dependencies
import { PrefabInstance } from "./PrefabInstance.ts";
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

    const instance = PrefabInstance.parse(actor, chain);
    const files = instance?.expand(prefabs) ?? null;
    if (instance !== null && files !== null) {
      yield* expand(files, prefabs, instance.innerChain);
    }
  }
}
