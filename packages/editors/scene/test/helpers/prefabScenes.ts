// Import Third-party Dependencies
import type { SceneDocument } from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { PrefabScenes } from "../../src/scene/PrefabScenes.ts";

export function createPrefabScenes(
  documents: Record<string, SceneDocument> = {}
) {
  const released: string[] = [];
  const scenes = new PrefabScenes((sceneId) => {
    const document = documents[sceneId];
    if (document === undefined) {
      throw new Error(`No scene ${sceneId}`);
    }

    return {
      document,
      ready: Promise.resolve(),
      release: () => released.push(sceneId)
    };
  });

  return { scenes, released };
}
