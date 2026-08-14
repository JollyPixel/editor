// Import Third-party Dependencies
import type { AssetLoadProgress } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { ManagedSceneLoad } from "./ManagedSceneLoad.ts";
import type { SceneLoadDriver } from "./SceneLoader.ts";
import type { WorldDefaultContext } from "../World.ts";

/**
 * Restricts a platform loader to reporting progress and completion.
 */
export class SceneLoadController<
  TContext = WorldDefaultContext
> implements SceneLoadDriver<TContext> {
  readonly load: ManagedSceneLoad<TContext>;

  constructor(
    load: ManagedSceneLoad<TContext>
  ) {
    this.load = load;
  }

  start(
    completed: number,
    total: number
  ): void {
    this.load.start(
      completed,
      total
    );
  }

  report(
    progress: AssetLoadProgress
  ): void {
    this.load.report(progress);
  }

  ready(): void {
    this.load.ready();
  }

  fail(
    error: Error
  ): void {
    this.load.fail(error);
  }

  activate(): void {
    this.load.activate();
  }
}
