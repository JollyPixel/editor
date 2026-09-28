// Import Third-party Dependencies
import { CommandSync } from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import {
  isVoxelWorldCommand,
  type VoxelCommandListener,
  type VoxelDocument,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  VoxelMapNetworkCommand,
  VoxelMapRoom
} from "./types.ts";

export interface VoxelSyncClientOptions {
  room: VoxelMapRoom;
  document: VoxelDocument;
}

export class VoxelSyncClient extends CommandSync<
  VoxelMapNetworkCommand,
  VoxelWorldJSON,
  AssetRoomNotice
> {
  #document: VoxelDocument;

  #sendLocalCommand: VoxelCommandListener = (command, { origin }) => {
    if (origin === "local" && isVoxelWorldCommand(command)) {
      this.send(command);
    }
  };

  constructor(
    options: VoxelSyncClientOptions
  ) {
    super(options.room);
    const { document } = options;

    this.#document = document;
    document.on("command", this.#sendLocalCommand);
    this.on("snapshot", (snapshot) => document.load(snapshot));
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
    this.#document.off("command", this.#sendLocalCommand);
    super.destroy();
  }

  #applyRemote(
    command: VoxelMapNetworkCommand
  ): void {
    if (command.action === "world-replace") {
      return;
    }

    this.#document.apply(command, { origin: "remote" });
  }
}
