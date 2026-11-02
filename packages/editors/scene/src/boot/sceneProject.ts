// Import Third-party Dependencies
import type { AssetSeedMap } from "@jolly-pixel/asset-server";
import { SCENE_KIND } from "@jolly-pixel/asset.scene";

export interface SceneProject {
  seed: AssetSeedMap;
}

export function createSceneProject(): SceneProject {
  return {
    seed: {
      "scenes/main.scene.json": {
        id: crypto.randomUUID(),
        kind: SCENE_KIND
      }
    }
  };
}
