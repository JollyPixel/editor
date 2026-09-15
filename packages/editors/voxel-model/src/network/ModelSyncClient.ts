// Import Third-party Dependencies
import {
  CommandSync,
  type Room
} from "@jolly-pixel/network/client";

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
  room: Room<ModelNetworkCommand, ModelServerMessage>;
  modelManager: ModelManager;
}

export class ModelSyncClient extends CommandSync<
  ModelNetworkCommand,
  ModelNodeJSON[]
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
    this.on("snapshot", (snapshot) => this.#applySnapshot(snapshot));
    this.on("command", (command) => this.#applyRemote(command));
  }

  override destroy(): void {
    this.#modelManager.onModelUpdated = this.#previousHandler;
    super.destroy();
    this.room.leave();
  }

  #applySnapshot(
    snapshot: ModelNodeJSON[]
  ): void {
    const target = this.#modelManager;

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

  #applyRemote(
    command: ModelNetworkCommand
  ): void {
    this.#modelManager.applyRemoteCommand(command);
    this.#previousHandler?.(command);
  }
}
