// Import Third-party Dependencies
import {
  CommandSync,
  type ConflictResolver
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import type {
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
import { ReplayBasis } from "./ReplayBasis.ts";
import { loadPixelSnapshot } from "./PixelSnapshotCodec.ts";

export interface PixelSyncTarget extends Pick<
  PixelDocument,
  "applyRemoteCommand" | "loadSnapshot"
> {
  on(event: "command", listener: (command: PixelCommand) => void): unknown;
  off(event: "command", listener: (command: PixelCommand) => void): unknown;
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
  #basis = new ReplayBasis();

  #sendLocalCommand = (
    command: PixelCommand
  ): void => {
    const { originTimestamp, ...body } = packPixelEvent(command);
    this.send(body, originTimestamp, this.#basis.of(originTimestamp));
  };

  constructor(
    options: PixelSyncClientOptions
  ) {
    super(options.room, {
      reconciler: createPixelReconciler(options.document),
      resolver: options.resolver,
      applySnapshot: (snapshot) => loadPixelSnapshot(options.document, snapshot)
    });
    const { document } = options;

    this.#document = document;
    document.on("command", this.#sendLocalCommand);
    this.on(
      "acknowledged",
      (command, version) => this.#basis.learn(command.timestamp, version)
    );
    this.on(
      "command",
      (command) => document.applyRemoteCommand(unpackPixelCommand(command))
    );
  }

  override destroy(): void {
    this.#document.off("command", this.#sendLocalCommand);
    super.destroy();
  }
}
