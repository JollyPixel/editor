// Import Third-party Dependencies
import {
  CommandSync,
  type Room
} from "@jolly-pixel/network/client";
import {
  decodePixelBytes,
  type PixelArtCanvas,
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

export interface PixelSyncClientOptions {
  room: Room<PixelNetworkCommand, PixelServerMessage>;
  canvas: PixelArtCanvas;
}

export class PixelSyncClient extends CommandSync<
  PixelNetworkCommand,
  PixelBufferSnapshot,
  PixelAssetNotice
> {
  #canvas: PixelArtCanvas;
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
    const { canvas } = options;

    this.#canvas = canvas;
    this.#previousHandler = canvas.onBufferUpdated;
    canvas.onBufferUpdated = this.#handleBufferUpdated;
    this.on("snapshot", (snapshot) => canvas.loadSnapshot(
      snapshot.size,
      decodePixelBytes(snapshot.pixels),
      snapshot.uvRegions
    ));
    this.on("command", (command) => canvas.applyRemoteCommand(command));
  }

  override destroy(): void {
    this.#canvas.onBufferUpdated = this.#previousHandler;
    super.destroy();
  }
}
