// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { RuntimeSceneProgress } from "../core/contract/RuntimeBackend.ts";

export async function loadEngineScene<TContext>(
  sceneManager: Systems.SceneManager<TContext>,
  scene: Systems.Scene<TContext>,
  onProgress: (progress: RuntimeSceneProgress) => void
): Promise<void> {
  const sceneLoad = sceneManager.loadScene(scene);

  function reportProgress(
    changedLoad: Systems.SceneLoad<TContext>
  ): void {
    if (changedLoad === sceneLoad) {
      onProgress(sceneLoad);
    }
  }

  sceneManager.on("sceneLoadChanged", reportProgress);
  reportProgress(sceneLoad);

  try {
    await sceneLoad.done;
  }
  finally {
    sceneManager.off("sceneLoadChanged", reportProgress);
  }
}
