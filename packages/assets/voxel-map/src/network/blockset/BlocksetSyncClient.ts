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
  pixelEdits,
  replayPixelCommand,
  revertsInPlace,
  unpackPixelCommand,
  type PixelCommandListener,
  type PixelEdits,
  type PixelSyncTarget
} from "@jolly-pixel/asset.pixel-art/client";
import type {
  BlocksetDocument,
  BlocksetDocumentListener
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  BlocksetNetworkCommand,
  BlocksetRoom,
  BlocksetSnapshot
} from "./types.ts";
import { blocksetWriteKeys } from "./BlocksetCommandKeys.ts";

export interface BlocksetSyncClientOptions {
  room: BlocksetRoom;
  pixels: PixelSyncTarget;
  blockset: BlocksetDocument;
  resolver?: ConflictResolver;
}

export function createBlocksetReconciler(
  pixels: PixelSyncTarget,
  blockset: BlocksetDocument
): CommandReconciler<BlocksetNetworkCommand> {
  return {
    keys: blocksetWriteKeys,
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
        blockset.applyCommand(command, { origin: "remote" })
    )
  };
}

function loadBlocksetSnapshot(
  blockset: BlocksetDocument,
  pixels: PixelSyncTarget,
  snapshot: BlocksetSnapshot
): void | Promise<void> {
  const { pixels: pixelSnapshot, ...document } = snapshot;
  blockset.load(document);

  return loadPixelSnapshot(pixels, pixelSnapshot);
}

export class BlocksetSyncClient extends CommandSync<
  BlocksetNetworkCommand,
  BlocksetSnapshot,
  AssetRoomNotice
> {
  #pixels: PixelSyncTarget;
  #pixelEdits: PixelEdits;
  #blockset: BlocksetDocument;

  #sendPixelCommand: PixelCommandListener = (command, change) => {
    this.sendChange(
      packPixelEvent(command),
      this.#pixelEdits.adapt(change)
    );
  };

  #sendBlocksetCommand: BlocksetDocumentListener = (command, { origin }) => {
    if (origin === "local") {
      this.send(command);
    }
  };

  constructor(
    options: BlocksetSyncClientOptions
  ) {
    const edits = pixelEdits(options.pixels);
    super(options.room, {
      reconciler: createBlocksetReconciler(
        options.pixels,
        options.blockset
      ),
      resolver: options.resolver,
      applySnapshot: (snapshot) => loadBlocksetSnapshot(
        options.blockset,
        options.pixels,
        snapshot
      ),
      receipts: edits.receipts
    });
    const { pixels, blockset } = options;

    this.#pixels = pixels;
    this.#pixelEdits = edits;
    this.#blockset = blockset;
    pixels.on("command", this.#sendPixelCommand);
    blockset.on("command", this.#sendBlocksetCommand);
    this.on("command", (command) => this.#applyRemote(command));
  }

  override destroy(): void {
    this.#pixels.off("command", this.#sendPixelCommand);
    this.#blockset.off("command", this.#sendBlocksetCommand);
    super.destroy();
  }

  #applyRemote(
    command: BlocksetNetworkCommand
  ): void {
    if (isPixelCommand(command)) {
      this.#pixels.applyRemoteCommand(
        unpackPixelCommand(command),
        command.clientId
      );

      return;
    }

    this.#blockset.applyCommand(command, { origin: "remote" });
  }
}
