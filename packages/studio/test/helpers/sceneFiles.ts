// Import Third-party Dependencies
import type {
  AssetReference,
  AssetReferenceData
} from "@jolly-pixel/asset";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { SceneFileSource } from "../../src/play/GameScenes.ts";

export function actor(
  id: string,
  fields: Partial<Systems.SceneActorFile>
): Systems.SceneActorFile {
  return {
    id,
    name: id,
    parentId: null,
    visible: true,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    },
    components: [],
    ...fields
  };
}

export function sceneWithActors(
  actors: Systems.SceneActorFile[]
): Systems.SceneFile {
  return {
    version: 1,
    environment: null,
    actors
  };
}

export function sceneFile(
  ...prefabs: AssetReferenceData[]
): Systems.SceneFile {
  return sceneWithActors(
    prefabs.map((prefab, index) => actor(`actor-${index}`, { prefab }))
  );
}

export function scenePrefab(
  id: string
): AssetReferenceData {
  return {
    id,
    kind: "scene"
  };
}

export class SceneFiles implements SceneFileSource {
  readonly loaded: string[] = [];

  #files: ReadonlyMap<string, Systems.SceneFile>;

  constructor(
    files: Iterable<[string, Systems.SceneFile]>
  ) {
    this.#files = new Map(files);
  }

  async load(
    reference: AssetReference<Systems.SceneFile>
  ): Promise<Systems.SceneFile> {
    const id = reference.id.value;
    this.loaded.push(id);
    const file = this.#files.get(id);
    if (file === undefined) {
      throw new Error(`${id} is missing`);
    }

    return file;
  }
}
