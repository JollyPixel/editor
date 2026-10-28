// Import Third-party Dependencies
import type {
  SceneDocument,
  SceneEnvironmentJSON
} from "@jolly-pixel/asset.scene/client";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { PrefabScenes } from "../../src/scene/PrefabScenes.ts";
import { SceneBinding } from "../../src/scene/SceneBinding.ts";
import { createEditWorld } from "./editWorld.ts";
import { createPrefabScenes } from "./prefabScenes.ts";

// CONSTANTS
export const BOUND_SCENE_ID = "level";

export function createSceneBinding(
  document: SceneDocument,
  components: Systems.ComponentDefinitions,
  prefabs: PrefabScenes = createPrefabScenes().scenes
) {
  const { world, sceneManager } = createEditWorld();
  const environments: SceneEnvironmentJSON[] = [];
  const binding = new SceneBinding({
    world,
    document,
    components,
    assets: {
      resolve: () => {
        throw new Error("No asset expected");
      }
    },
    environment: {
      apply: (environment) => environments.push(environment)
    },
    prefabs,
    sceneId: BOUND_SCENE_ID
  });

  return {
    world,
    binding,
    sceneManager,
    environments
  };
}
