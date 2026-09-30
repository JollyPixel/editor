// Import Third-party Dependencies
import { CommandSync } from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import {
  isPixelCommand,
  loadPixelSnapshot,
  packPixelEvent,
  unpackPixelCommand,
  type PixelSyncTarget
} from "@jolly-pixel/asset.pixel-art/client";
import type { PixelBufferHookEvent } from "@jolly-pixel/pixel-draw.renderer";
import type {
  TilesetDocument,
  TilesetDocumentListener
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  TilesetNetworkCommand,
  TilesetRoom,
  TilesetSnapshot
} from "./types.ts";

export interface TilesetSyncClientOptions {
  room: TilesetRoom;
  pixels: PixelSyncTarget;
  tileset: TilesetDocument;
}

export class TilesetSyncClient extends CommandSync<
  TilesetNetworkCommand,
  TilesetSnapshot,
  AssetRoomNotice
> {
  #pixels: PixelSyncTarget;
  #tileset: TilesetDocument;

  #sendPixelCommand = (
    event: PixelBufferHookEvent
  ): void => {
    const { originTimestamp, ...body } = packPixelEvent(event);
    this.send(body, originTimestamp);
  };

  #sendTilesetCommand: TilesetDocumentListener = (command, { origin }) => {
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
    pixels.on("buffer-updated", this.#sendPixelCommand);
    tileset.on("command", this.#sendTilesetCommand);
    this.on("snapshot", (snapshot) => this.#loadSnapshot(snapshot));
    this.on("command", (command) => this.#applyRemote(command));
  }

  override destroy(): void {
    this.#pixels.off("buffer-updated", this.#sendPixelCommand);
    this.#tileset.off("command", this.#sendTilesetCommand);
    super.destroy();
  }

  #loadSnapshot(
    snapshot: TilesetSnapshot
  ): void {
    const { pixels, ...document } = snapshot;

    this.#tileset.load(document);
    loadPixelSnapshot(this.#pixels, pixels);
  }

  #applyRemote(
    command: TilesetNetworkCommand
  ): void {
    if (isPixelCommand(command)) {
      this.#pixels.applyRemoteCommand(unpackPixelCommand(command));

      return;
    }

    this.#tileset.apply(command, { origin: "remote" });
  }
}
