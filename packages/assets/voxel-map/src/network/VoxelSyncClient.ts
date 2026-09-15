// Import Third-party Dependencies
import {
  CommandSync,
  type Room
} from "@jolly-pixel/network/client";
import type {
  VoxelEngine,
  VoxelBlockHookEvent,
  VoxelBlockHookListener,
  VoxelLayerHookEvent,
  VoxelLayerHookListener,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  VoxelAssetNotice,
  VoxelNetworkCommand,
  VoxelServerMessage
} from "./types.ts";

export interface VoxelSyncClientOptions {
  room: Room<VoxelNetworkCommand, VoxelServerMessage>;
  engine: VoxelEngine;
}

export class VoxelSyncClient extends CommandSync<
  VoxelNetworkCommand,
  VoxelWorldJSON,
  VoxelAssetNotice
> {
  #engine: VoxelEngine;
  #previousLayerHandler: VoxelLayerHookListener | undefined;
  #previousBlockHandler: VoxelBlockHookListener | undefined;
  #applyingRemote = false;

  #handleLayerUpdated = (
    event: VoxelLayerHookEvent
  ): void => {
    this.#previousLayerHandler?.(event);
    this.send(event);
  };

  #handleBlockUpdated = (
    event: VoxelBlockHookEvent
  ): void => {
    this.#previousBlockHandler?.(event);
    if (!this.#applyingRemote) {
      this.send(event);
    }
  };

  constructor(
    options: VoxelSyncClientOptions
  ) {
    super(options.room);
    const { engine } = options;

    this.#engine = engine;
    this.#previousLayerHandler = engine.onLayerUpdated;
    this.#previousBlockHandler = engine.onBlockUpdated;
    engine.onLayerUpdated = this.#handleLayerUpdated;
    engine.onBlockUpdated = this.#handleBlockUpdated;
    this.on("snapshot", (snapshot) => engine.load(snapshot));
    this.on("command", (command) => this.#applyRemote(command));
  }

  replaceWorld(
    data: VoxelWorldJSON
  ): void {
    this.send({
      action: "world-replace",
      data
    });
  }

  override destroy(): void {
    this.#engine.onLayerUpdated = this.#previousLayerHandler;
    this.#engine.onBlockUpdated = this.#previousBlockHandler;
    super.destroy();
    this.room.leave();
  }

  #applyRemote(
    command: VoxelNetworkCommand
  ): void {
    const engine = this.#engine;

    switch (command.action) {
      case "world-replace":
        return;
      case "block-defined":
        this.#applyBlock(() => engine.defineBlock(command.block));
        break;
      case "block-removed":
        this.#applyBlock(() => engine.removeBlock(command.blockId));
        break;
      case "block-moved":
        this.#applyBlock(
          () => engine.moveBlock(command.blockId, command.toIndex)
        );
        break;
      default:
        engine.applyRemoteCommand(command);
        this.#previousLayerHandler?.(command);
    }
  }

  #applyBlock(
    apply: () => void
  ): void {
    this.#applyingRemote = true;
    try {
      apply();
    }
    finally {
      this.#applyingRemote = false;
    }
  }
}
