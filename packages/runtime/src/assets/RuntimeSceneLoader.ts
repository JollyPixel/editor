// Import Third-party Dependencies
import type { AssetCoordinator } from "@jolly-pixel/asset";
import type { Systems } from "@jolly-pixel/engine";

/**
 * Loads scene assets and reports their progress to the engine SceneManager.
 */
export class RuntimeSceneLoader<
  TContext = Systems.WorldDefaultContext
> implements Systems.SceneLoader<TContext> {
  #coordinator: AssetCoordinator;

  constructor(
    coordinator: AssetCoordinator
  ) {
    this.#coordinator = coordinator;
  }

  load(
    driver: Systems.SceneLoadDriver<TContext>
  ): void {
    const batch = this.#coordinator.loadBatch(
      driver.load.scene.assets,
      {
        onProgress: (progress) => {
          driver.report(progress);
        }
      }
    );
    driver.start(
      batch.completed,
      batch.total
    );

    void batch.done.then(
      () => driver.ready(),
      (value: unknown) => driver.fail(toError(value))
    );
  }
}

function toError(
  value: unknown
): Error {
  return value instanceof Error ? value : new Error(String(value));
}
