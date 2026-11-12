// Import Third-party Dependencies
import {
  blankPixelDocument,
  isPixelCommand,
  pixelEdits,
  type PixelEdits,
  type SyncedPixelDocumentOptions
} from "@jolly-pixel/asset.pixel-art/client";
import type { LocalEdits } from "@jolly-pixel/history";
import {
  SyncedDocument,
  type DocumentKind
} from "@jolly-pixel/network/client";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import { BlocksetDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BLOCKSET_KIND } from "../../asset/blockset.ts";
import { BlocksetSyncClient } from "./BlocksetSyncClient.ts";
import type {
  BlocksetEditCommand,
  BlocksetRoom
} from "./types.ts";

export type SyncedBlocksetOptions = SyncedPixelDocumentOptions;

type ReceiptsSource = LocalEdits<unknown>["receipts"];

export class SyncedBlockset
  extends SyncedDocument<SyncedBlockset>
  implements LocalEdits<BlocksetEditCommand> {
  readonly pixels: PixelDocument;
  readonly blockset: BlocksetDocument;
  readonly receipts: ReceiptsSource;

  #sync: BlocksetSyncClient;
  #pixelEdits: PixelEdits;

  get document(): this {
    return this;
  }

  constructor(
    room: BlocksetRoom,
    options: SyncedBlocksetOptions = {}
  ) {
    const pixels = blankPixelDocument(options);
    const blockset = new BlocksetDocument();
    const sync = new BlocksetSyncClient({
      room,
      pixels,
      blockset
    });
    super(sync);
    this.pixels = pixels;
    this.blockset = blockset;
    this.#sync = sync;
    this.#pixelEdits = pixelEdits(pixels);
    this.receipts = bothReceipts(sync.receipts, this.#pixelEdits.receipts);
  }

  applyStep(
    command: BlocksetEditCommand
  ): object | null {
    return isPixelCommand(command) ?
      this.#pixelEdits.applyStep(command) :
      this.#sync.applyStep(command);
  }

  override dispose(): void {
    super.dispose();
    this.blockset.dispose();
  }
}

function bothReceipts(
  first: ReceiptsSource,
  second: ReceiptsSource
): ReceiptsSource {
  return {
    subscribe: (event, listener) => {
      const unsubscribers = [
        first.subscribe(event, listener),
        second.subscribe(event, listener)
      ];

      return () => {
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
      };
    }
  };
}

export type BlocksetDocumentKind = DocumentKind<
  typeof BLOCKSET_KIND,
  BlocksetRoom,
  SyncedBlockset
>;

export function blocksetDocumentKind(
  options: SyncedBlocksetOptions = {}
): BlocksetDocumentKind {
  return {
    kind: BLOCKSET_KIND,
    syncDocument: (room) => new SyncedBlockset(room, options)
  };
}
