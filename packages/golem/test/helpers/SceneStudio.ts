// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import { LiveAssetRoom } from "@jolly-pixel/asset-server/testing";
import {
  createSceneFile,
  sceneAssetKind,
  type SceneNetworkCommand,
  type SceneSnapshot,
  type SceneState
} from "@jolly-pixel/asset.scene";
import { sceneEditableKind } from "@jolly-pixel/asset.scene/server";

// Import Internal Dependencies
import { SceneAsset } from "#src/assets/scene/SceneAsset.ts";
import { mockOpening } from "./opening.ts";
import { MockStudio } from "./MockStudio.ts";

export class SceneStudio extends MockStudio<
  LiveAssetRoom<SceneState, SceneNetworkCommand>,
  SceneNetworkCommand,
  SceneSnapshot
> {
  readonly scene: SceneAsset;

  constructor(
    records: readonly AssetRecordData[] = []
  ) {
    super(new LiveAssetRoom(sceneAssetKind()));
    this.scene = new SceneAsset(
      mockOpening(this.room, records),
      sceneEditableKind()
    );
  }

  async open(): Promise<void> {
    this.server.state.load(createSceneFile());
    await this.connect();
    await this.scene.ready;
  }

  actorNamed(
    name: string
  ): string {
    const actor = [...this.scene.tree.actors()]
      .find((actor) => actor.name === name);
    assert.ok(actor);

    return actor.id;
  }
}
