// Import Third-party Dependencies
import {
  SCENE_CAPABILITIES,
  type SceneCommandAction
} from "@jolly-pixel/asset.scene/client";
import {
  Grants,
  type RoomGrantsEventMap
} from "@jolly-pixel/network/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  SCENE_CAPABILITY_TABLE,
  SceneAccess,
  type SceneCapability
} from "../../src/access/SceneAccess.ts";

class TestSceneGrants extends Emitter<
  RoomGrantsEventMap<SceneCommandAction, SceneCapability>
> {
  current: Grants<SceneCapability> = SCENE_CAPABILITY_TABLE.full;
}

export class TestSceneAccess extends SceneAccess {
  #grants: TestSceneGrants;

  constructor() {
    const grants = new TestSceneGrants();
    super(grants);
    this.#grants = grants;
  }

  grant(
    ...capabilities: [SceneCapability, ...SceneCapability[]]
  ): void {
    this.#set(capabilities);
  }

  withhold(
    ...capabilities: [SceneCapability, ...SceneCapability[]]
  ): void {
    this.#set(SCENE_CAPABILITIES
      .map(({ name }) => name)
      .filter((name) => !capabilities.includes(name)));
  }

  viewOnly(): void {
    this.#set([]);
  }

  #set(
    capabilities: Iterable<SceneCapability>
  ): void {
    this.#grants.current = new Grants(capabilities);
    this.#grants.emit("change", this.#grants.current);
  }
}

export function sceneAccess(): TestSceneAccess {
  return new TestSceneAccess();
}
