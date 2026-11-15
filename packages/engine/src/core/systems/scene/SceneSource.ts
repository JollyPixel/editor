// Import Internal Dependencies
import type { Scene } from "./Scene.ts";
import type { WorldDefaultContext } from "../World.ts";

export interface SceneSource<
  TContext = WorldDefaultContext
> {
  scene(
    ref: string
  ): Scene<TContext>;
}
