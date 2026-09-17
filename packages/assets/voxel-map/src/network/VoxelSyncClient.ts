// Import Third-party Dependencies
import {
  CommandSync,
  type Room
} from "@jolly-pixel/network/client";
import type {
  VoxelCommandListener,
  VoxelEngine,
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

  #sendLocalCommand: VoxelCommandListener = (command, { origin }) => {
    if (origin === "local") {
      this.send(command);
    }
  };

  constructor(
    options: VoxelSyncClientOptions
  ) {
    super(options.room);
    const { engine } = options;

    this.#engine = engine;
    engine.on("command", this.#sendLocalCommand);
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
    this.#engine.off("command", this.#sendLocalCommand);
    super.destroy();
    this.room.leave();
  }

  #applyRemote(
    command: VoxelNetworkCommand
  ): void {
    if (command.action === "world-replace") {
      return;
    }

    this.#engine.apply(command, { origin: "remote" });
  }
}
