// Import Third-party Dependencies
import type { AssetLoadProgress } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { SceneLoad } from "./SceneLoad.ts";
import type { WorldDefaultContext } from "../World.ts";

export interface SceneLoadDriver<
  TContext = WorldDefaultContext
> {
  readonly load: SceneLoad<TContext>;

  start(
    completed: number,
    total: number
  ): void;
  report(
    progress: AssetLoadProgress
  ): void;
  ready(): void;
  fail(
    error: Error
  ): void;
}

export interface SceneLoader<
  TContext = WorldDefaultContext
> {
  load(
    driver: SceneLoadDriver<TContext>
  ): void;
}
