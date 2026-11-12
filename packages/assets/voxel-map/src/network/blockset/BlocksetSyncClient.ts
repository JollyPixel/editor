// Import Third-party Dependencies
import { ChangeReceipts } from "@jolly-pixel/history";
import {
  CommandSync,
  type CommandReconciler
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import {
  isPixelCommand,
  loadPixelSnapshot,
  narrowPixelCommand,
  pixelEdits,
  PixelLink,
  replayPixelCommand,
  revertsInPlace,
  type PixelSyncTarget
} from "@jolly-pixel/asset.pixel-art/client";
import type {
  BlocksetDocument,
  BlocksetDocumentCommand,
  BlocksetDocumentListener
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  BlocksetNetworkCommand,
  BlocksetRoom,
  BlocksetSnapshot,
  BlocksetStep
} from "./types.ts";
import { blocksetWriteKeys } from "./BlocksetCommandKeys.ts";

export interface BlocksetSyncClientOptions {
  room: BlocksetRoom;
  pixels: PixelSyncTarget;
  blockset: BlocksetDocument;
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
  readonly receipts = new ChangeReceipts<BlocksetStep>();

  #pixels: PixelLink;
  #blockset: BlocksetDocument;
  #step: BlocksetStep | null = null;

  #sendBlocksetCommand: BlocksetDocumentListener = (command, { origin }) => {
    if (origin !== "local") {
      return;
    }

    if (this.#step === null) {
      this.send(command);
    }
    else {
      this.sendChange(command, this.#step, this.receipts);
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
      applySnapshot: (snapshot) => loadBlocksetSnapshot(
        options.blockset,
        options.pixels,
        snapshot
      ),
      receipts: edits.receipts
    });

    this.#pixels = new PixelLink(options.pixels, edits, this);
    this.#blockset = options.blockset;
    this.#blockset.on("command", this.#sendBlocksetCommand);
    this.on("command", (command) => this.#applyRemote(command));
  }

  applyStep(
    command: BlocksetDocumentCommand
  ): BlocksetStep | null {
    const step: BlocksetStep = { command };
    this.#step = step;
    try {
      return this.#blockset.applyCommand(command) ? step : null;
    }
    finally {
      this.#step = null;
    }
  }

  override destroy(): void {
    this.#pixels.dispose();
    this.#blockset.off("command", this.#sendBlocksetCommand);
    super.destroy();
  }

  #applyRemote(
    command: BlocksetNetworkCommand
  ): void {
    if (isPixelCommand(command)) {
      this.#pixels.applyRemote(command);

      return;
    }

    this.#blockset.applyCommand(command, { origin: "remote" });
  }
}
