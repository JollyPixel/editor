// Import Third-party Dependencies
import {
  AssetSource,
  type AssetRecordData
} from "@jolly-pixel/asset";
import type { CatalogCreateOptions } from "@jolly-pixel/asset-server/client";
import {
  createTilesetAsset,
  createTilesetDocument,
  tilesetAsset,
  TILESET_EXTENSION
} from "@jolly-pixel/asset.voxel-map/client";
import {
  TilesetSlot,
  type BlockDefinition,
  type MaterialGroup,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import type { SelectionRect } from "@jolly-pixel/pixel-draw.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocument } from "../../document/MapDocument.ts";
import {
  BlockAlphaModes,
  type TilesetPixels
} from "./BlockAlphaModes.ts";
import { TilesetEntry } from "./TilesetEntry.ts";
import {
  TilesetBinding,
  type BlockWriter,
  type OpenedTileset
} from "./TilesetBinding.ts";
import {
  TileOccupancy,
  type TilePosition
} from "./TileOccupancy.ts";

// CONSTANTS
const kTilesetDirectory = "tilesets/";

export interface TilesetCatalog {
  records(): Iterable<AssetRecordData>;
  record(assetId: string): AssetRecordData | undefined;
  create(
    path: string,
    content: Uint8Array,
    options?: CatalogCreateOptions
  ): Promise<string>;
  rename(assetId: string, to: string): Promise<void>;
  on(event: "change", listener: () => void): unknown;
  off(event: "change", listener: () => void): unknown;
}

export interface CreateTilesetOptions {
  name: string;
  tileSize: number;
  cols: number;
  rows: number;
}

export interface MapTilesetsOptions {
  view: VoxelView;
  catalog: TilesetCatalog;
  mapDocument: MapDocument;
  open: (assetId: string) => OpenedTileset;
  generateId?: () => string;
}

export type MapTilesetsEvents = {
  change: () => void;
  activeChange: (tilesetId: string | null) => void;
};

export class MapTilesets
  extends Emitter<MapTilesetsEvents>
  implements BlockWriter {
  readonly #view: VoxelView;
  readonly #catalog: TilesetCatalog;
  readonly #mapDocument: MapDocument;
  readonly #open: (assetId: string) => OpenedTileset;
  readonly #generateId: () => string;
  readonly #bindings = new Map<string, TilesetBinding>();
  readonly #alphaModes: BlockAlphaModes;
  readonly #unsubscribe: () => void;
  #entries: readonly TilesetEntry[] = [];
  #activeTilesetId: string | null = null;

  constructor(
    options: MapTilesetsOptions
  ) {
    super();
    this.#view = options.view;
    this.#catalog = options.catalog;
    this.#mapDocument = options.mapDocument;
    this.#open = options.open;
    this.#generateId = options.generateId ?? (() => crypto.randomUUID());
    this.#alphaModes = new BlockAlphaModes({
      view: this.#view,
      pixelsOf: (tilesetId) => this.#loadedPixelsOf(tilesetId)
    });

    this.#catalog.on("change", this.refresh);
    this.#unsubscribe = this.#mapDocument.subscribe(
      "tilesetsChanged",
      this.refresh
    );
    this.refresh();
  }

  get entries(): readonly TilesetEntry[] {
    return this.#entries;
  }

  get activeTilesetId(): string | null {
    return this.#activeTilesetId;
  }

  set activeTilesetId(
    tilesetId: string | null
  ) {
    if (tilesetId !== null && this.entry(tilesetId) === undefined) {
      return;
    }

    this.#assignActive(tilesetId);
  }

  entry(
    tilesetId: string
  ): TilesetEntry | undefined {
    return this.#entries.find((entry) => entry.id === tilesetId);
  }

  open(
    tilesetId: string
  ): TilesetBinding | undefined {
    return this.#bindings.get(tilesetId);
  }

  ownerOf(
    blockId: number
  ): TilesetBinding | undefined {
    return [...this.#bindings.values()].find(
      (binding) => binding.slot.owns(blockId)
    );
  }

  tileSizeOf(
    tilesetId: string
  ): number | undefined {
    return this.#bindings.get(tilesetId)?.opened.tileset.tileSize;
  }

  nextBlockId(
    tilesetId: string
  ): number | undefined {
    return this.#bindings.get(tilesetId)?.link.nextBlockId;
  }

  freeTile(
    tilesetId: string,
    size: number | undefined
  ): TilePosition | undefined {
    const tileSize = this.tileSizeOf(tilesetId);
    if (tileSize === undefined) {
      return undefined;
    }

    const { atlases, shapes, document } = this.#view;
    const atlas = atlases.get(tilesetId)?.def;
    const occupancy = TileOccupancy.of(
      document.blocks.getAll(),
      (shapeId) => shapes.get(shapeId),
      tilesetId,
      tileSize
    );

    return occupancy.firstFree(size ?? tileSize, {
      width: atlas && atlas.cols * atlas.tileSize,
      height: atlas && atlas.rows * atlas.tileSize
    });
  }

  defineBlock(
    block: BlockDefinition
  ): boolean {
    const owner = this.ownerOf(block.id);
    if (owner === undefined) {
      return false;
    }

    return owner.link.defineBlock(
      this.#alphaModes.resolve(block, owner.definition.id)
    );
  }

  syncAlphaModes(
    tilesetId: string,
    bounds?: SelectionRect
  ): void {
    for (const block of this.#alphaModes.staleIn(tilesetId, bounds)) {
      this.ownerOf(block.id)?.link.defineBlock(block);
    }
  }

  removeBlock(
    blockId: number
  ): boolean {
    return this.ownerOf(blockId)?.link.removeBlock(blockId) ?? false;
  }

  moveBlock(
    blockId: number,
    toIndex: number
  ): boolean {
    return this.ownerOf(blockId)?.link.moveBlock(blockId, toIndex) ?? false;
  }

  defineMaterialGroup(
    group: MaterialGroup
  ): boolean {
    return this.#materialGroupOwnerOf(group.id)?.link
      .defineMaterialGroup(group.toJSON()) ?? false;
  }

  removeMaterialGroup(
    groupId: string
  ): boolean {
    return this.#materialGroupOwnerOf(groupId)?.link
      .removeMaterialGroup(groupId) ?? false;
  }

  resizeTiles(
    tilesetId: string,
    tileSize: number
  ): boolean {
    const binding = this.#bindings.get(tilesetId);

    return binding !== undefined &&
      binding.opened.tileset.resizeTiles(tileSize);
  }

  linkableAssets(): AssetRecordData[] {
    const linked = new Set(this.#entries.map((entry) => entry.assetId));

    return [...this.#catalog.records()]
      .filter((record) => TilesetEntry.isTilesetAsset(record) && !linked.has(record.id))
      .sort((left, right) => left.source.localeCompare(right.source));
  }

  async create(
    options: CreateTilesetOptions
  ): Promise<string | null> {
    const assetId = await createTilesetAsset(
      this.#catalog,
      `${kTilesetDirectory}${options.name.trim()}${TILESET_EXTENSION}`,
      createTilesetDocument({
        tileSize: options.tileSize,
        size: {
          x: options.cols * options.tileSize,
          y: options.rows * options.tileSize
        }
      })
    );

    return this.link(assetId);
  }

  link(
    assetId: string
  ): string | null {
    const tilesetId = this.#uniqueTilesetId();
    const added = this.#view.document.addTileset({
      id: tilesetId,
      asset: tilesetAsset(assetId)
    });

    return added ? tilesetId : null;
  }

  remove(
    tilesetId: string
  ): boolean {
    return this.#view.document.removeTileset(tilesetId);
  }

  async rename(
    tilesetId: string,
    name: string
  ): Promise<void> {
    const assetId = this.entry(tilesetId)?.assetId ?? null;
    const record = assetId === null ? undefined : this.#catalog.record(assetId);
    const trimmed = name.trim();
    if (record === undefined || trimmed.length === 0) {
      return;
    }

    const to = new AssetSource(record.source)
      .withName(trimmed)
      .toString();
    if (to !== record.source) {
      await this.#catalog.rename(record.id, to);
    }
  }

  readonly refresh = (): void => {
    const entries = TilesetEntry.resolveAll(
      this.#view.document.tilesets,
      this.#catalog.records()
    );
    if (
      entries.length === this.#entries.length &&
      entries.every((entry, index) => entry.equals(this.#entries[index]))
    ) {
      return;
    }

    this.#entries = entries;
    const active = this.#activeTilesetId;
    if (active === null || this.entry(active) === undefined) {
      this.#assignActive(entries[0]?.id ?? null);
    }
    this.#reconcileBindings();
    this.emit("change");
  };

  dispose(): void {
    this.#unsubscribe();
    this.#catalog.off("change", this.refresh);
    for (const [tilesetId, binding] of this.#bindings) {
      this.#unbind(tilesetId, binding);
    }
  }

  #assignActive(
    tilesetId: string | null
  ): void {
    if (tilesetId !== this.#activeTilesetId) {
      this.#activeTilesetId = tilesetId;
      this.emit("activeChange", tilesetId);
    }
  }

  #reconcileBindings(): void {
    const entries = new Map(
      this.#entries.map((entry) => [entry.id, entry])
    );
    for (const [tilesetId, binding] of this.#bindings) {
      const entry = entries.get(tilesetId);
      if (entry === undefined || !binding.boundTo(entry)) {
        this.#unbind(tilesetId, binding);
      }
    }

    for (const [tilesetId, entry] of entries) {
      const binding = this.#bindings.get(tilesetId);
      if (binding === undefined) {
        this.#bind(entry);
      }
      else {
        binding.update(entry.definition);
      }
    }
  }

  #bind(
    entry: TilesetEntry
  ): void {
    const { definition, assetId } = entry;
    if (definition.slot === undefined || assetId === null) {
      return;
    }

    let opened: OpenedTileset;
    try {
      opened = this.#open(assetId);
    }
    catch (error) {
      console.error(
        `MapTilesets: cannot open tileset "${definition.id}"`,
        error
      );

      return;
    }

    const binding = new TilesetBinding({
      view: this.#view,
      entry,
      slot: new TilesetSlot({
        id: definition.id,
        slot: definition.slot
      }),
      opened,
      mapDocument: this.#mapDocument,
      blocks: this
    });
    this.#bindings.set(definition.id, binding);
    void opened.ready.then(() => {
      if (this.#bindings.get(definition.id) === binding) {
        this.emit("change");
      }
    });
  }

  #unbind(
    tilesetId: string,
    binding: TilesetBinding
  ): void {
    this.#bindings.delete(tilesetId);
    binding.dispose();
  }

  #loadedPixelsOf(
    tilesetId: string
  ): TilesetPixels | undefined {
    const binding = this.#bindings.get(tilesetId);
    if (binding === undefined || !binding.loaded) {
      return undefined;
    }

    return {
      tileSize: binding.opened.tileset.tileSize,
      pixels: binding.opened.pixels
    };
  }

  #materialGroupOwnerOf(
    groupId: string
  ): TilesetBinding | undefined {
    return [...this.#bindings.values()].find(
      (binding) => binding.slot.localGroupId(groupId) !== null
    );
  }

  #uniqueTilesetId(): string {
    const taken = this.#view.document.tilesets.ids();
    let tilesetId = this.#generateId();
    while (taken.has(tilesetId)) {
      tilesetId = this.#generateId();
    }

    return tilesetId;
  }
}
