// Import Third-party Dependencies
import {
  CommandSync,
  type ConflictResolver
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import type {
  PixelChange,
  PixelCommand,
  PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  PixelArtRoom,
  PixelWireCommand,
  PixelWireSnapshot
} from "./types.ts";
import {
  packPixelEvent,
  unpackPixelCommand
} from "./PixelWireCodec.ts";
import { createPixelReconciler } from "./PixelReconciler.ts";
import { loadPixelSnapshot } from "./PixelSnapshotCodec.ts";

export type PixelCommandListener = (
  command: PixelCommand,
  change: PixelChange
) => void;

export interface PixelSyncTarget extends Pick<
  PixelDocument,
  "applyRemoteCommand" | "replayPendingCommand" | "loadSnapshot" | "receipts"
> {
  on(
    event: "command",
    listener: PixelCommandListener
  ): unknown;
  off(
    event: "command",
    listener: PixelCommandListener
  ): unknown;
}

export interface PixelSyncClientOptions {
  room: PixelArtRoom;
  document: PixelSyncTarget;
  resolver?: ConflictResolver;
}

export class PixelSyncClient extends CommandSync<
  PixelWireCommand,
  PixelWireSnapshot,
  AssetRoomNotice
> {
  #document: PixelSyncTarget;

  #sendLocalCommand: PixelCommandListener = (command, change) => {
    this.sendChange(
      packPixelEvent(command),
      change
    );
  };

  constructor(
    options: PixelSyncClientOptions
  ) {
    super(options.room, {
      reconciler: createPixelReconciler(options.document),
      resolver: options.resolver,
      applySnapshot: (snapshot) => loadPixelSnapshot(
        options.document,
        snapshot
      ),
      receipts: options.document.receipts
    });
    const { document } = options;

    this.#document = document;
    document.on("command", this.#sendLocalCommand);
    this.on(
      "command",
      (command) => document.applyRemoteCommand(
        unpackPixelCommand(command),
        command.clientId
      )
    );
  }

  override destroy(): void {
    this.#document.off("command", this.#sendLocalCommand);
    super.destroy();
  }
}
