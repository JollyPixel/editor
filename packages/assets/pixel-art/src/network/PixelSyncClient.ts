// Import Third-party Dependencies
import { CommandSync } from "@jolly-pixel/network/client";
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

  #sendLocalCommand = (
    event: PixelBufferHookEvent
  ): void => {
    const { originTimestamp, ...body } = packPixelEvent(event);
    this.send(body, originTimestamp);
  };

  constructor(
    options: PixelSyncClientOptions
  ) {
    super(options.room);
    const { document } = options;

    this.#document = document;
    document.on("buffer-updated", this.#sendLocalCommand);
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
