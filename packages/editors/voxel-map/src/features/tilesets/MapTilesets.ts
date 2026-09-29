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
  composeBlockId,
  localBlockIdOf,
  localMaterialGroupId,
  localTilesetBlock,
  resolveBlockDefinition,
  tilesetSlotOf,
  type BlockDefinition,
  type MaterialGroup,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocument } from "../../document/index.ts";
import {
  entriesEqual,
  isTilesetAsset,
  resolveTilesetEntries,
  type TilesetEntry
} from "./tilesetEntry.ts";
import {
  TilesetBinding,
  type BlockWriter,
  type OpenedTileset
} from "./TilesetBinding.ts";
import {
  firstFreeTile,
  occupiedTileRects,
  type TilePosition
} from "./blockTilesets.ts";

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
  engine: VoxelView;
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
  readonly #engine: VoxelView;
  readonly #catalog: TilesetCatalog;
  readonly #mapDocument: MapDocument;
  readonly #open: (assetId: string) => OpenedTileset;
  readonly #generateId: () => string;
  readonly #bindings = new Map<string, TilesetBinding>();
  readonly #unsubscribe: () => void;
  #entries: readonly TilesetEntry[] = [];
  #activeTilesetId: string | null = null;

  constructor(
    options: MapTilesetsOptions
  ) {
    super();
    this.#engine = options.engine;
    this.#catalog = options.catalog;
    this.#mapDocument = options.mapDocument;
    this.#open = options.open;
    this.#generateId = options.generateId ?? (() => crypto.randomUUID());

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
    return this.#entries.find(
      (entry) => entry.definition.id === tilesetId
    );
  }

  open(
    tilesetId: string
  ): TilesetBinding | undefined {
    return this.#bindings.get(tilesetId);
  }

  ownerOf(
    blockId: number
  ): TilesetBinding | undefined {
    const slot = tilesetSlotOf(blockId);
    for (const binding of this.#bindings.values()) {
      if (binding.slot.slot === slot) {
        return binding;
      }
    }

    return undefined;
  }

  tileSizeOf(
    tilesetId: string
  ): number | undefined {
    return this.#bindings.get(tilesetId)?.opened.tileset.tileSize;
  }

  nextBlockId(
    tilesetId: string
  ): number | undefined {
    const binding = this.#bindings.get(tilesetId);
    if (binding === undefined) {
      return undefined;
    }

    return composeBlockId(
      binding.slot.slot,
      binding.opened.tileset.blocks.nextId
    );
  }

  freeTile(
    tilesetId: string,
    size: number | undefined
  ): TilePosition | undefined {
    const tileSize = this.tileSizeOf(tilesetId);
    if (tileSize === undefined) {
      return undefined;
    }

    const { atlases, shapes, document } = this.#engine;
    const atlas = atlases.get(tilesetId)?.def;
    const occupied = occupiedTileRects(
      document.blocks.getAll(),
      (shapeId) => shapes.get(shapeId),
      tilesetId,
      tileSize
    );

    return firstFreeTile(
      {
        tileSize,
        width: atlas && atlas.cols * atlas.tileSize,
        height: atlas && atlas.rows * atlas.tileSize
      },
      size ?? tileSize,
      occupied
    );
  }

  defineBlock(
    block: BlockDefinition
  ): boolean {
    const resolved = resolveBlockDefinition(block);
    const owner = this.ownerOf(resolved.id);

    return owner !== undefined && owner.opened.tileset.defineBlock(
      localTilesetBlock(owner.slot, resolved)
    );
  }

  defineBlocks(
    blocks: Iterable<BlockDefinition>
  ): void {
    for (const block of blocks) {
      this.defineBlock(block);
    }
  }

  removeBlock(
    blockId: number
  ): boolean {
    const owner = this.ownerOf(blockId);

    return owner !== undefined &&
      owner.opened.tileset.removeBlock(localBlockIdOf(blockId));
  }

  moveBlock(
    blockId: number,
    toIndex: number
  ): boolean {
    const owner = this.ownerOf(blockId);
    if (owner === undefined) {
      return false;
    }

    let localIndex = 0;
    let index = 0;
    for (const block of this.#engine.document.blocks) {
      if (block.id === blockId) {
        continue;
      }
      if (index >= toIndex) {
        break;
      }
      if (tilesetSlotOf(block.id) === owner.slot.slot) {
        localIndex++;
      }
      index++;
    }

    return owner.opened.tileset.moveBlock(localBlockIdOf(blockId), localIndex);
  }

  defineMaterialGroup(
    group: MaterialGroup
  ): boolean {
    const owner = this.#materialGroupOwnerOf(group.id);

    return owner !== undefined && owner.opened.tileset.defineMaterialGroup({
      ...group.toJSON(),
      id: localMaterialGroupId(owner.slot, group.id)
    });
  }

  removeMaterialGroup(
    groupId: string
  ): boolean {
    const owner = this.#materialGroupOwnerOf(groupId);

    return owner !== undefined &&
      owner.opened.tileset.removeMaterialGroup(
        localMaterialGroupId(owner.slot, groupId)
      );
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
      .filter((record) => isTilesetAsset(record) && !linked.has(record.id))
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
    const added = this.#engine.document.addTileset({
      id: tilesetId,
      asset: tilesetAsset(assetId)
    });

    return added ? tilesetId : null;
  }

  remove(
    tilesetId: string
  ): boolean {
    return this.#engine.document.removeTileset(tilesetId);
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
    const entries = resolveTilesetEntries(
      this.#engine.document.tilesets,
      this.#catalog.records()
    );
    if (entriesEqual(this.#entries, entries)) {
      return;
    }

    this.#entries = entries;
    const active = this.#activeTilesetId;
    if (active === null || this.entry(active) === undefined) {
      this.#assignActive(entries[0]?.definition.id ?? null);
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
      this.#entries.map((entry) => [entry.definition.id, entry])
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
      engine: this.#engine,
      entry,
      slot: {
        id: definition.id,
        slot: definition.slot
      },
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

  #materialGroupOwnerOf(
    groupId: string
  ): TilesetBinding | undefined {
    for (const binding of this.#bindings.values()) {
      if (localMaterialGroupId(binding.slot, groupId) !== groupId) {
        return binding;
      }
    }

    return undefined;
  }

  #uniqueTilesetId(): string {
    const taken = this.#engine.document.tilesets.ids();
    let tilesetId = this.#generateId();
    while (taken.has(tilesetId)) {
      tilesetId = this.#generateId();
    }

    return tilesetId;
  }
}
