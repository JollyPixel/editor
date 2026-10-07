// Import Third-party Dependencies
import {
  CommandSync,
  type ConflictResolver
} from "@jolly-pixel/network/client";
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
import { VoxelReconciler } from "./VoxelReconciler.ts";

export interface VoxelSyncClientOptions {
  room: VoxelMapRoom;
  document: VoxelDocument;
  resolver?: ConflictResolver;
}

export class VoxelSyncClient extends CommandSync<
  VoxelMapNetworkCommand,
  VoxelWorldJSON,
  AssetRoomNotice
> {
  #document: VoxelDocument;
  #reconciler: VoxelReconciler;
  #onCommand: VoxelCommandListener;
  #onLoaded: () => void;

  constructor(
    options: VoxelSyncClientOptions
  ) {
    const reconciler = new VoxelReconciler(options.document);
    super(options.room, {
      reconciler,
      resolver: options.resolver,
      receipts: options.document.edits.receipts
    });
    const { document } = options;

    this.#document = document;
    this.#reconciler = reconciler;
    this.#onCommand = (command, { origin }) => {
      if (origin === "local" && isVoxelWorldCommand(command)) {
        const change = document.edits.changeOf(command);
        reconciler.capture(
          change === undefined
            ? this.send(command)
            : this.sendChange(command, change)
        );
      }
      reconciler.observe();
    };
    this.#onLoaded = () => reconciler.observe();
    document.on("command", this.#onCommand);
    document.on("loaded", this.#onLoaded);
    this.on("snapshot", (snapshot) => document.load(snapshot));
    this.on("command", (command) => this.#applyRemote(command));
  }

  replaceWorld(
    data: VoxelWorldJSON
  ): void {
    this.#reconciler.capture(this.send({
      action: "world-replace",
      data
    }));
  }

  override destroy(): void {
    this.#document.off("command", this.#onCommand);
    this.#document.off("loaded", this.#onLoaded);
    this.#reconciler.dispose();
    super.destroy();
  }

  #applyRemote(
    command: VoxelMapNetworkCommand
  ): void {
    if (command.action === "world-replace") {
      return;
    }

    this.#document.apply(command, {
      origin: "remote",
      clientId: command.clientId
    });
  }
}
