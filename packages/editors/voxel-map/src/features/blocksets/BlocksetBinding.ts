// Import Third-party Dependencies
import type {
  PixelDocument,
  SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";
import {
  BlocksetLink,
  type BlockDefinition,
  type BlocksetDefinition,
  type BlocksetDocument,
  type BlocksetSlot,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import {
  blocksetDocumentKind,
  type BlocksetRoom
} from "@jolly-pixel/asset.voxel-map/client";
import type { AssetLeases } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { MapDocument } from "../../document/MapDocument.ts";
import type { BlocksetEntry } from "./BlocksetEntry.ts";
import { BlocksetAtlasBridge } from "./BlocksetAtlasBridge.ts";

// CONSTANTS
export const BLOCKSET_DOCUMENT_KIND = blocksetDocumentKind({
  maxSize: 2048
});

export interface OpenedBlockset {
  readonly pixels: PixelDocument;
  readonly blockset: BlocksetDocument;
  readonly room: BlocksetRoom;
  readonly ready: Promise<void>;
  release(): void;
}

export interface BlockWriter {
  defineBlock(block: BlockDefinition): void;
  syncAlphaModes(blocksetId: string, bounds?: SelectionRect): void;
}

export interface BlocksetBindingOptions {
  view: VoxelView;
  entry: BlocksetEntry;
  slot: BlocksetSlot;
  opened: OpenedBlockset;
  mapDocument: MapDocument;
  blocks: BlockWriter;
}

export class BlocksetBinding {
  readonly assetId: string | null;
  readonly opened: OpenedBlockset;
  readonly link: BlocksetLink;
  readonly #atlas: BlocksetAtlasBridge;
  #definition: BlocksetDefinition;
  #loaded = false;

  constructor(
    options: BlocksetBindingOptions
  ) {
    const { view, entry, opened } = options;

    this.assetId = entry.assetId;
    this.opened = opened;
    this.#definition = entry.definition;
    this.link = new BlocksetLink({
      document: view.document,
      blockset: opened.blockset,
      slot: options.slot
    });
    this.#atlas = new BlocksetAtlasBridge({
      view,
      pixels: opened.pixels,
      blockset: opened.blockset,
      definition: entry.definition,
      mapDocument: options.mapDocument,
      blocks: options.blocks
    });
    void opened.ready.then(() => {
      this.#loaded = true;
      this.#atlas.syncAlphaModes();
    });
  }

  get loaded(): boolean {
    return this.#loaded;
  }

  get slot(): BlocksetSlot {
    return this.link.slot;
  }

  get definition(): BlocksetDefinition {
    return this.#definition;
  }

  boundTo(
    entry: BlocksetEntry
  ): boolean {
    return this.assetId === entry.assetId &&
      this.slot.slot === entry.definition.slot;
  }

  update(
    definition: BlocksetDefinition
  ): void {
    this.#definition = definition;
    this.#atlas.update(definition);
  }

  dispose(): void {
    this.#atlas.destroy();
    this.link.dispose();
    this.opened.release();
  }
}

export function openBlockset(
  assets: AssetLeases,
  assetId: string
): OpenedBlockset {
  const lease = assets.open(BLOCKSET_DOCUMENT_KIND, assetId);

  return {
    pixels: lease.document.pixels,
    blockset: lease.document.blockset,
    room: lease.room,
    ready: lease.ready,
    release: () => lease.release()
  };
}
