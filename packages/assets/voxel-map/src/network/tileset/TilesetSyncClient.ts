// Import Third-party Dependencies
import {
  CommandSync,
  type CommandReconciler,
  type ConflictResolver
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import {
  isPixelCommand,
  loadPixelSnapshot,
  narrowPixelCommand,
  packPixelEvent,
  replayPixelCommand,
  ReplayBasis,
  revertsInPlace,
  unpackPixelCommand,
  type PixelSyncTarget
} from "@jolly-pixel/asset.pixel-art/client";
import type { PixelCommand } from "@jolly-pixel/pixel-draw.renderer";
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
import { tilesetWriteKeys } from "./TilesetCommandKeys.ts";

export interface TilesetSyncClientOptions {
  room: TilesetRoom;
  pixels: PixelSyncTarget;
  tileset: TilesetDocument;
  resolver?: ConflictResolver;
}

export function createTilesetReconciler(
  pixels: PixelSyncTarget,
  tileset: TilesetDocument
): CommandReconciler<TilesetNetworkCommand> {
  return {
    keys: tilesetWriteKeys,
    narrow: (command, keep) => (
      isPixelCommand(command) ? narrowPixelCommand(command, keep) : null
    ),
    revert: (pending) => pending.every((command) => (
      isPixelCommand(command) ?
        revertsInPlace(command) :
        command.action !== "block-moved"
    )),
    replay: (command) => (
      isPixelCommand(command) ?
        replayPixelCommand(pixels, command) :
        tileset.apply(command, { origin: "remote" })
    )
  };
}

function loadTilesetSnapshot(
  tileset: TilesetDocument,
  pixels: PixelSyncTarget,
  snapshot: TilesetSnapshot
): void | Promise<void> {
  const { pixels: pixelSnapshot, ...document } = snapshot;
  tileset.load(document);

  return loadPixelSnapshot(pixels, pixelSnapshot);
}

export class TilesetSyncClient extends CommandSync<
  TilesetNetworkCommand,
  TilesetSnapshot,
  AssetRoomNotice
> {
  #pixels: PixelSyncTarget;
  #tileset: TilesetDocument;
  #basis = new ReplayBasis();

  #sendPixelCommand = (
    command: PixelCommand
  ): void => {
    const { originTimestamp, ...body } = packPixelEvent(command);
    this.send(body, originTimestamp, this.#basis.of(originTimestamp));
  };

  #sendTilesetCommand: TilesetDocumentListener = (command, { origin }) => {
    if (origin === "local") {
      this.send(command);
    }
  };

  constructor(
    options: TilesetSyncClientOptions
  ) {
    super(options.room, {
      reconciler: createTilesetReconciler(options.pixels, options.tileset),
      resolver: options.resolver,
      applySnapshot: (snapshot) => loadTilesetSnapshot(
        options.tileset,
        options.pixels,
        snapshot
      )
    });
    const { pixels, tileset } = options;

    this.#pixels = pixels;
    this.#tileset = tileset;
    pixels.on("command", this.#sendPixelCommand);
    this.on(
      "acknowledged",
      (command, version) => this.#basis.learn(command.timestamp, version)
    );
    tileset.on("command", this.#sendTilesetCommand);
    this.on("command", (command) => this.#applyRemote(command));
  }

  override destroy(): void {
    this.#pixels.off("command", this.#sendPixelCommand);
    this.#tileset.off("command", this.#sendTilesetCommand);
    super.destroy();
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
