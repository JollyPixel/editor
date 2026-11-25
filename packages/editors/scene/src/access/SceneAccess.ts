// Import Third-party Dependencies
import {
  SCENE_CAPABILITIES,
  type SceneCommandAction
} from "@jolly-pixel/asset.scene/client";
import { Systems } from "@jolly-pixel/ecs";
import {
  CapabilityTable,
  type CapabilityName,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type SceneCapability = CapabilityName<typeof SCENE_CAPABILITIES>;
export type SceneGrants = RoomGrants<SceneCommandAction, SceneCapability>;
export type SceneGrantsSource = Pick<SceneGrants, "current" | "subscribe">;

export const SCENE_CAPABILITY_TABLE = new CapabilityTable(SCENE_CAPABILITIES);

export class SceneAccess {
  readonly #grants: SceneGrantsSource;

  constructor(
    grants: SceneGrantsSource
  ) {
    this.#grants = grants;
  }

  get readOnly(): boolean {
    return this.#grants.current.readOnly;
  }

  can(
    capability: SceneCapability,
    actorId?: string
  ): boolean {
    const inner = actorId !== undefined &&
      Systems.InstancePath.parse(actorId) !== null;

    return this.#grants.current.has(inner ? "instances" : capability);
  }

  subscribe(
    listener: () => void
  ): () => void {
    return this.#grants.subscribe("change", listener);
  }
}
