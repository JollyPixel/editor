// Import Third-party Dependencies
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import {
  TilesetLink,
  type BlockDefinition,
  type TilesetDefinition,
  type TilesetDocument,
  type TilesetSlot,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import {
  tilesetDocumentKind,
  type TilesetRoom
} from "@jolly-pixel/asset.voxel-map/client";
import type { AssetLeases } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { MapDocument } from "../../document/index.ts";
import type { TilesetEntry } from "./TilesetEntry.ts";
import { TilesetAtlasBridge } from "./TilesetAtlasBridge.ts";

// CONSTANTS
export const TILESET_DOCUMENT_KIND = tilesetDocumentKind({
  maxSize: 2048,
  history: {
    enabled: true
  }
});

export interface OpenedTileset {
  readonly pixels: PixelDocument;
  readonly tileset: TilesetDocument;
  readonly room: TilesetRoom;
  readonly ready: Promise<void>;
  release(): void;
}

export interface BlockWriter {
  defineBlock(block: BlockDefinition): void;
  defineBlocks(blocks: Iterable<BlockDefinition>): void;
}

export interface TilesetBindingOptions {
  view: VoxelView;
  entry: TilesetEntry;
  slot: TilesetSlot;
  opened: OpenedTileset;
  mapDocument: MapDocument;
  blocks: BlockWriter;
}

export class TilesetBinding {
  readonly assetId: string | null;
  readonly opened: OpenedTileset;
  readonly link: TilesetLink;
  readonly #atlas: TilesetAtlasBridge;
  #definition: TilesetDefinition;

  constructor(
    options: TilesetBindingOptions
  ) {
    const { view, entry, opened } = options;

    this.assetId = entry.assetId;
    this.opened = opened;
    this.#definition = entry.definition;
    this.link = new TilesetLink({
      document: view.document,
      tileset: opened.tileset,
      slot: options.slot
    });
    this.#atlas = new TilesetAtlasBridge({
      view,
      pixels: opened.pixels,
      tileset: opened.tileset,
      definition: entry.definition,
      mapDocument: options.mapDocument,
      blocks: options.blocks
    });
  }

  get slot(): TilesetSlot {
    return this.link.slot;
  }

  get definition(): TilesetDefinition {
    return this.#definition;
  }

  boundTo(
    entry: TilesetEntry
  ): boolean {
    return this.assetId === entry.assetId &&
      this.slot.slot === entry.definition.slot;
  }

  update(
    definition: TilesetDefinition
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

export function openTileset(
  assets: AssetLeases,
  assetId: string
): OpenedTileset {
  const lease = assets.open(TILESET_DOCUMENT_KIND, assetId);

  return {
    pixels: lease.document.pixels,
    tileset: lease.document.tileset,
    room: lease.room,
    ready: lease.ready,
    release: () => lease.release()
  };
}
