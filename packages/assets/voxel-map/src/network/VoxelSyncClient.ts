// Import Third-party Dependencies
import { CommandSync } from "@jolly-pixel/network/client";
import {
  isVoxelWorldCommand,
  type VoxelCommandListener,
  type VoxelDocument,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  VoxelAssetNotice,
  VoxelMapRoom,
  VoxelNetworkCommand
} from "./types.ts";

export interface VoxelSyncClientOptions {
  room: VoxelMapRoom;
  document: VoxelDocument;
}

/**
 * Sends the world commands of a document to its room and applies the room's
 * back. Block and material group commands stay local: they are projected
 * from tileset documents, which have rooms of their own.
 */
export class VoxelSyncClient extends CommandSync<
  VoxelNetworkCommand,
  VoxelWorldJSON,
  VoxelAssetNotice
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
    command: VoxelNetworkCommand
  ): void {
    if (command.action === "world-replace") {
      return;
    }

    this.#document.apply(command, { origin: "remote" });
  }
}
