// Import Third-party Dependencies
import { CommandSync } from "@jolly-pixel/network/client";
import type {
  VoxelModelAssetNotice,
  VoxelModelNetworkCommand,
  VoxelModelSnapshot
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import type {
  ModelChange,
  ModelDocument
} from "../model/index.ts";
import type { VoxelModelRoom } from "./types.ts";

export interface ModelSyncClientOptions {
  room: VoxelModelRoom;
  document: ModelDocument;
}

export class ModelSyncClient extends CommandSync<
  VoxelModelNetworkCommand,
  VoxelModelSnapshot,
  VoxelModelAssetNotice
> {
  #document: ModelDocument;

  #onChange = (
    change: ModelChange
  ): void => {
    if (change.origin === "local") {
      this.send(change.command);
    }
  };

  constructor(
    options: ModelSyncClientOptions
  ) {
    super(options.room);
    this.#document = options.document;

    this.#document.on("change", this.#onChange);
    this.on("snapshot", (snapshot) => this.#document.load(snapshot));
    this.on("command", (command) => this.#document.apply(command));
  }

  override destroy(): void {
    this.#document.off("change", this.#onChange);
    super.destroy();
  }
}
