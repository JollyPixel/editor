// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { Scene } from "./Scene.ts";
import type { WorldDefaultContext } from "../World.ts";

export type SceneLoadStatus =
  | "requested"
  | "loading"
  | "ready"
  | "failed"
  | "cancelled"
  | "active";

export type SceneActivation =
  | "automatic"
  | "manual";

export interface SceneLoadOptions {
  /**
   * Controls whether readiness immediately permits scene activation.
   * @default "automatic"
   */
  activation?: SceneActivation;
}

export interface SceneLoad<
  TContext = WorldDefaultContext
> {
  readonly scene: Scene<TContext>;
  readonly status: SceneLoadStatus;
  readonly activationAllowed: boolean;
  readonly completed: number;
  readonly total: number;
  readonly currentAsset: AssetRecord | null;
  readonly error: Error | null;

  allowActivation(): void;
  cancel(): void;
}
