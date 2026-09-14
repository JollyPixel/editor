// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type ModelManager from "../features/groups/ModelManager.ts";
import type {
  ModelHookEvent,
  ModelHookListener
} from "../features/groups/hooks.ts";
import {
  toEuler,
  toVector3
} from "../features/groups/transformCodec.ts";
import type {
  ModelNetworkCommand,
  ModelNodeJSON,
  ModelServerMessage
} from "./types.ts";

export interface ModelSyncClientOptions {
  room: network.Room<ModelNetworkCommand, ModelServerMessage>;
}

export class ModelSyncClient extends network.SyncAdapter<
  ModelManager,
  ModelHookEvent,
  ModelNetworkCommand,
  ModelNodeJSON[]
> {
  constructor(
    options: ModelSyncClientOptions
  ) {
    super(options.room);
  }

  protected getHandler(
    target: ModelManager
  ): ModelHookListener | undefined {
    return target.onModelUpdated;
  }

  protected setHandler(
    target: ModelManager,
    fn: ModelHookListener | undefined
  ): void {
    target.onModelUpdated = fn;
  }

  protected applySnapshot(
    target: ModelManager,
    snapshot: ModelNodeJSON[]
  ): void {
    target.silently(() => {
      target.disposeAll();

      for (const node of snapshot) {
        target.addGroup({
          uuid: node.uuid,
          name: node.name,
          pos: toVector3(node.position),
          pivotPos: toVector3(node.pivotOffset),
          size: toVector3(node.size),
          scale: toVector3(node.scale),
          rotation: toEuler(node.rotation)
        });
      }

      for (const node of snapshot) {
        if (node.parentUuid !== null) {
          target.reparentLocal(node.uuid, node.parentUuid);
        }
      }
    });
  }

  protected applyRemoteCommand(
    target: ModelManager,
    cmd: ModelNetworkCommand
  ): void {
    target.applyRemoteCommand(cmd);
    this.notifyLocal(cmd);
  }
}
