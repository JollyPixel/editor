// Import Third-party Dependencies
import { CommandSync } from "@jolly-pixel/network/client";
import {
  isModelCommand,
  type ModelNodeJSON,
  type VoxelModelAssetNotice,
  type VoxelModelNetworkCommand,
  type VoxelModelSnapshot
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

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
import type { VoxelModelRoom } from "./types.ts";

export interface ModelSyncClientOptions {
  room: VoxelModelRoom;
  modelManager: ModelManager;
}

export class ModelSyncClient extends CommandSync<
  VoxelModelNetworkCommand,
  VoxelModelSnapshot,
  VoxelModelAssetNotice
> {
  #modelManager: ModelManager;
  #previousHandler: ModelHookListener | undefined;

  #handleModelUpdated = (
    event: ModelHookEvent
  ): void => {
    this.#previousHandler?.(event);
    this.send(event);
  };

  constructor(
    options: ModelSyncClientOptions
  ) {
    super(options.room);
    const { modelManager } = options;

    this.#modelManager = modelManager;
    this.#previousHandler = modelManager.onModelUpdated;
    modelManager.onModelUpdated = this.#handleModelUpdated;
    this.on("snapshot", (snapshot) => this.#applySnapshot(snapshot.nodes));
    this.on("command", (command) => {
      if (isModelCommand(command)) {
        this.#applyRemote(command);
      }
    });
  }

  override destroy(): void {
    this.#modelManager.onModelUpdated = this.#previousHandler;
    super.destroy();
  }

  #applySnapshot(
    nodes: ModelNodeJSON[]
  ): void {
    const target = this.#modelManager;

    target.silently(() => {
      target.disposeAll();

      for (const node of nodes) {
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

      for (const node of nodes) {
        if (node.parentUuid !== null) {
          target.reparentLocal(node.uuid, node.parentUuid);
        }
        if (node.flipAxes) {
          target.setFlipAxes(node.uuid, node.flipAxes);
        }
      }
    });
  }

  #applyRemote(
    command: ModelHookEvent
  ): void {
    this.#modelManager.applyRemoteCommand(command);
    this.#previousHandler?.(command);
  }
}
