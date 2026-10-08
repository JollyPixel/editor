// Import Third-party Dependencies
import {
  CommandSync,
  type ConflictResolver
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import type { ChangeSource } from "@jolly-pixel/history";
import type {
  DocumentCommand,
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
import {
  pixelEdits,
  type PixelEdits
} from "../history/PixelEdits.ts";

export type PixelCommandListener = (
  command: PixelCommand,
  change: PixelChange
) => void;

export interface PixelSyncTarget extends Pick<
  PixelDocument,
  "applyRemoteCommand" | "replayPendingCommand" | "loadSnapshot"
>, ChangeSource<DocumentCommand> {
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
  #edits: PixelEdits;

  #sendLocalCommand: PixelCommandListener = (command, change) => {
    this.sendChange(
      packPixelEvent(command),
      this.#edits.adapt(change)
    );
  };

  constructor(
    options: PixelSyncClientOptions
  ) {
    const edits = pixelEdits(options.document);
    super(options.room, {
      reconciler: createPixelReconciler(options.document),
      resolver: options.resolver,
      applySnapshot: (snapshot) => loadPixelSnapshot(
        options.document,
        snapshot
      ),
      receipts: edits.receipts
    });
    const { document } = options;

    this.#document = document;
    this.#edits = edits;
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
