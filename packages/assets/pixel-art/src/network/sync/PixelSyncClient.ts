// Import Third-party Dependencies
import { CommandSync } from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  PixelArtRoom,
  PixelWireCommand,
  PixelWireSnapshot
} from "../protocol/types.ts";
import { createPixelReconciler } from "./PixelReconciler.ts";
import { loadPixelSnapshot } from "../protocol/PixelSnapshotCodec.ts";
import {
  PixelLink,
  type PixelSyncTarget
} from "./PixelLink.ts";
import { pixelEdits } from "../../history/PixelEdits.ts";

export interface PixelSyncClientOptions {
  room: PixelArtRoom;
  document: PixelSyncTarget;
}

export class PixelSyncClient extends CommandSync<
  PixelWireCommand,
  PixelWireSnapshot,
  AssetRoomNotice
> {
  #link: PixelLink;

  constructor(
    options: PixelSyncClientOptions
  ) {
    const edits = pixelEdits(options.document);
    super(options.room, {
      reconciler: createPixelReconciler(options.document),
      applySnapshot: (snapshot) => loadPixelSnapshot(
        options.document,
        snapshot
      ),
      receipts: edits.receipts
    });

    this.#link = new PixelLink(options.document, edits, this);
    this.on("command", (command) => this.#link.applyRemote(command));
  }

  override destroy(): void {
    this.#link.dispose();
    super.destroy();
  }
}
