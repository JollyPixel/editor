// Import Third-party Dependencies
import { CommandSync } from "@jolly-pixel/network/client";
import {
  decodePixelBytes,
  type PixelBufferHookEvent,
  type PixelBufferHookListener,
  type PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";
import type {
  TilesetDocument,
  TilesetDocumentListener
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  isPixelNetworkCommand,
  type TilesetAssetNotice,
  type TilesetNetworkCommand,
  type TilesetRoom,
  type TilesetSnapshot
} from "./types.ts";

export type TilesetPixelsTarget = Pick<
  PixelDocument,
  "onBufferUpdated" | "applyRemoteCommand" | "loadSnapshot"
>;

export interface TilesetSyncClientOptions {
  room: TilesetRoom;
  pixels: TilesetPixelsTarget;
  tileset: TilesetDocument;
}

/**
 * Keeps a tileset's pixels and document in step with its room. Local pixel
 * edits and local document commands go out; remote ones come back in.
 */
export class TilesetSyncClient extends CommandSync<
  TilesetNetworkCommand,
  TilesetSnapshot,
  TilesetAssetNotice
> {
  #pixels: TilesetPixelsTarget;
  #tileset: TilesetDocument;
  #previousHandler: PixelBufferHookListener | undefined;

  #handleBufferUpdated = (
    event: PixelBufferHookEvent
  ): void => {
    this.#previousHandler?.(event);

    const { originTimestamp, ...body } = event;
    this.send(body, originTimestamp);
  };

  #sendLocalCommand: TilesetDocumentListener = (command, { origin }) => {
    if (origin === "local") {
      this.send(command);
    }
  };

  constructor(
    options: TilesetSyncClientOptions
  ) {
    super(options.room);
    const { pixels, tileset } = options;

    this.#pixels = pixels;
    this.#tileset = tileset;
    this.#previousHandler = pixels.onBufferUpdated;
    pixels.onBufferUpdated = this.#handleBufferUpdated;
    tileset.on("command", this.#sendLocalCommand);
    this.on("snapshot", (snapshot) => this.#loadSnapshot(snapshot));
    this.on("command", (command) => this.#applyRemote(command));
  }

  override destroy(): void {
    this.#pixels.onBufferUpdated = this.#previousHandler;
    this.#tileset.off("command", this.#sendLocalCommand);
    super.destroy();
  }

  #loadSnapshot(
    snapshot: TilesetSnapshot
  ): void {
    const { pixels, ...document } = snapshot;

    this.#tileset.load(document);
    this.#pixels.loadSnapshot(
      pixels.size,
      decodePixelBytes(pixels.pixels),
      pixels.uvRegions
    );
  }

  #applyRemote(
    command: TilesetNetworkCommand
  ): void {
    if (isPixelNetworkCommand(command)) {
      this.#pixels.applyRemoteCommand(command);

      return;
    }

    this.#tileset.apply(command, { origin: "remote" });
  }
}
