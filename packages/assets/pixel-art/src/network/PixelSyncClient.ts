// Import Third-party Dependencies
import {
  CommandSync,
  type ConflictResolver
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import {
  decodePixelBytes,
  type PixelBufferHookEvent,
  type PixelBufferHookListener,
  type PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  PixelArtRoom,
  PixelBufferSnapshot,
  PixelWireCommand
} from "./types.ts";
import {
  packPixelEvent,
  unpackPixelCommand
} from "./PixelWireCodec.ts";
import { createPixelReconciler } from "./PixelReconciler.ts";
import { ReplayBasis } from "./ReplayBasis.ts";

export interface PixelSyncTarget extends Pick<
  PixelDocument,
  "applyRemoteCommand" | "loadSnapshot"
> {
  on(event: "buffer-updated", listener: PixelBufferHookListener): unknown;
  off(event: "buffer-updated", listener: PixelBufferHookListener): unknown;
}

export interface PixelSyncClientOptions {
  room: PixelArtRoom;
  document: PixelSyncTarget;
  resolver?: ConflictResolver;
}

export function loadPixelSnapshot(
  target: Pick<PixelDocument, "loadSnapshot">,
  snapshot: PixelBufferSnapshot
): void {
  target.loadSnapshot(
    snapshot.size,
    decodePixelBytes(snapshot.pixels),
    snapshot.uvRegions
  );
}

export class PixelSyncClient extends CommandSync<
  PixelWireCommand,
  PixelBufferSnapshot,
  AssetRoomNotice
> {
  #document: PixelSyncTarget;
  #basis = new ReplayBasis();

  #sendLocalCommand = (
    event: PixelBufferHookEvent
  ): void => {
    const { originTimestamp, ...body } = packPixelEvent(event);
    this.send(body, originTimestamp, this.#basis.of(originTimestamp));
  };

  constructor(
    options: PixelSyncClientOptions
  ) {
    super(options.room, {
      reconciler: createPixelReconciler(options.document),
      resolver: options.resolver
    });
    const { document } = options;

    this.#document = document;
    document.on("buffer-updated", this.#sendLocalCommand);
    this.on(
      "acknowledged",
      (command, version) => this.#basis.learn(command.timestamp, version)
    );
    this.on("snapshot", (snapshot) => loadPixelSnapshot(document, snapshot));
    this.on(
      "command",
      (command) => document.applyRemoteCommand(unpackPixelCommand(command))
    );
  }

  override destroy(): void {
    this.#document.off("buffer-updated", this.#sendLocalCommand);
    super.destroy();
  }
}
