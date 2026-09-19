// Import Third-party Dependencies
import {
  CommandSync,
  type Room
} from "@jolly-pixel/network/client";
import {
  decodePixelBytes,
  type PixelDocument,
  type PixelBufferHookEvent,
  type PixelBufferHookListener
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  PixelAssetNotice,
  PixelBufferSnapshot,
  PixelNetworkCommand,
  PixelServerMessage
} from "./types.ts";

export type PixelSyncTarget = Pick<
  PixelDocument,
  "onBufferUpdated" | "applyRemoteCommand" | "loadSnapshot"
>;

export interface PixelSyncClientOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  document: PixelSyncTarget;
}

export class PixelSyncClient extends CommandSync<
  PixelNetworkCommand,
  PixelBufferSnapshot,
  PixelAssetNotice
> {
  #document: PixelSyncTarget;
  #previousHandler: PixelBufferHookListener | undefined;

  #handleBufferUpdated = (
    event: PixelBufferHookEvent
  ): void => {
    this.#previousHandler?.(event);

    const { originTimestamp, ...body } = event;
    this.send(body, originTimestamp);
  };

  constructor(
    options: PixelSyncClientOptions
  ) {
    super(options.room);
    const { document } = options;

    this.#document = document;
    this.#previousHandler = document.onBufferUpdated;
    document.onBufferUpdated = this.#handleBufferUpdated;
    this.on("snapshot", (snapshot) => document.loadSnapshot(
      snapshot.size,
      decodePixelBytes(snapshot.pixels),
      snapshot.uvRegions
    ));
    this.on("command", (command) => document.applyRemoteCommand(command));
  }

  override destroy(): void {
    this.#document.onBufferUpdated = this.#previousHandler;
    super.destroy();
  }
}
