// Import Third-party Dependencies
import type {
  SceneDocument,
  SceneEnvironmentJSON
} from "@jolly-pixel/asset.scene/client";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { SceneBinding } from "../../src/scene/SceneBinding.ts";
import { createEditWorld } from "./editWorld.ts";

export function createSceneBinding(
  document: SceneDocument,
  components: Systems.ComponentDefinitions
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
    }
  });

  return {
    world,
    binding,
    sceneManager,
    environments
  };
}
