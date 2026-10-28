// Import Internal Dependencies
import type { SceneFile } from "./SceneFile.ts";

export type ScenePrefabFile = Pick<SceneFile, "actors">;

export interface ScenePrefabs {
  find(
    sceneId: string
  ): Readonly<ScenePrefabFile> | null;
}

export const NO_SCENE_PREFABS: ScenePrefabs = {
  find: () => null
};

export function* includedSceneFiles(
  file: Readonly<ScenePrefabFile>,
  prefabs: ScenePrefabs,
  sceneId?: string
): IterableIterator<Readonly<ScenePrefabFile>> {
  const visited = new Set(sceneId === undefined ? [] : [sceneId]);
  const files = [file];

  for (const next of files) {
    yield next;

    for (const { prefab } of next.actors) {
      if (prefab === undefined || visited.has(prefab.id)) {
        continue;
      }
      visited.add(prefab.id);

      const included = prefabs.find(prefab.id);
      if (included !== null) {
        files.push(included);
      }
    }
  }
}
