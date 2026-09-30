// Import Third-party Dependencies
import {
  CommandSync,
  type ConflictResolver
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  ModelChange,
  ModelDocument
} from "../model/ModelDocument.ts";
import type {
  VoxelModelNetworkCommand,
  VoxelModelRoom,
  VoxelModelSnapshot
} from "./types.ts";
import { ModelReconciler } from "./ModelReconciler.ts";

export interface ModelSyncClientOptions {
  room: VoxelModelRoom;
  document: ModelDocument;
  resolver?: ConflictResolver<VoxelModelNetworkCommand>;
}

export class ModelSyncClient extends CommandSync<
  VoxelModelNetworkCommand,
  VoxelModelSnapshot,
  AssetRoomNotice
> {
  #document: ModelDocument;
  #onChange: (change: ModelChange) => void;

  constructor(
    options: ModelSyncClientOptions
  ) {
    const reconciler = new ModelReconciler(options.document);
    super(options.room, {
      reconciler,
      resolver: options.resolver
    });
    this.#document = options.document;
    this.#onChange = (change) => {
      if (change.origin === "local") {
        reconciler.capture(this.send(change.command), change);
      }
    };

    this.#document.on("change", this.#onChange);
    this.on("snapshot", (snapshot) => this.#document.load(snapshot));
    this.on("command", (command) => this.#document.apply(command));
  }

  override destroy(): void {
    this.#document.off("change", this.#onChange);
    super.destroy();
  }
}
