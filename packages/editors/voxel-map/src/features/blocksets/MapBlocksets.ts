// Import Third-party Dependencies
import {
  AssetSource,
  type AssetRecordData
} from "@jolly-pixel/asset";
import type { CatalogCreateOptions } from "@jolly-pixel/asset-server/client";
import {
  createBlocksetAsset,
  createBlocksetDocument,
  blocksetAsset,
  BLOCKSET_EXTENSION
} from "@jolly-pixel/asset.voxel-map/client";
import {
  BlocksetSlot,
  type BlockDefinition,
  type MaterialGroup,
  type VoxelView
} from "@jolly-pixel/voxel.renderer";
import type { SelectionRect } from "@jolly-pixel/pixel-draw.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocument } from "../../document/MapDocument.ts";
import {
  BLOCKSET_CAPABILITIES,
  type BlocksetAccess,
  type BlocksetCapability
} from "../../access/BlocksetAccess.ts";
import {
  BlockAlphaModes,
  type BlocksetPixels
} from "./BlockAlphaModes.ts";
import { BlocksetEntry } from "./BlocksetEntry.ts";
import {
  BlocksetBinding,
  type BlockWriter,
  type OpenedBlockset
} from "./BlocksetBinding.ts";
import {
  TileOccupancy,
  type TilePosition
} from "./TileOccupancy.ts";

// CONSTANTS
const kBlocksetDirectory = "blocksets/";

export interface BlocksetCatalog {
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

export interface CreateBlocksetOptions {
  name: string;
  tileSize: number;
  cols: number;
  rows: number;
}

export interface MapBlocksetsOptions {
  view: VoxelView;
  catalog: BlocksetCatalog;
  mapDocument: MapDocument;
  open: (assetId: string) => OpenedBlockset;
  generateId?: () => string;
}

export type MapBlocksetsEvents = {
  change: () => void;
  activeChange: (blocksetId: string | null) => void;
  denied: (blocksetId: string) => void;
};

export class MapBlocksets
  extends Emitter<MapBlocksetsEvents>
  implements BlockWriter {
  readonly #view: VoxelView;
  readonly #catalog: BlocksetCatalog;
  readonly #mapDocument: MapDocument;
  readonly #open: (assetId: string) => OpenedBlockset;
  readonly #generateId: () => string;
  readonly #bindings = new Map<string, BlocksetBinding>();
  readonly #alphaModes: BlockAlphaModes;
  readonly #unsubscribe: () => void;
  #entries: readonly BlocksetEntry[] = [];
  #activeBlocksetId: string | null = null;

  constructor(
    options: MapBlocksetsOptions
  ) {
    super();
    this.#view = options.view;
    this.#catalog = options.catalog;
    this.#mapDocument = options.mapDocument;
    this.#open = options.open;
    this.#generateId = options.generateId ?? (() => crypto.randomUUID());
    this.#alphaModes = new BlockAlphaModes({
      view: this.#view,
      resolvePixels: (blocksetId) => this.#resolveLoadedPixels(blocksetId)
    });

    this.#catalog.on("change", this.refresh);
    this.#unsubscribe = this.#mapDocument.subscribe(
      "blocksetsChanged",
      this.refresh
    );
    this.refresh();
  }

  get entries(): readonly BlocksetEntry[] {
    return this.#entries;
  }

  get activeBlocksetId(): string | null {
    return this.#activeBlocksetId;
  }

  set activeBlocksetId(
    blocksetId: string | null
  ) {
    if (blocksetId !== null && this.entry(blocksetId) === undefined) {
      return;
    }

    this.#assignActive(blocksetId);
  }

  entry(
    blocksetId: string
  ): BlocksetEntry | undefined {
    return this.#entries.find((entry) => entry.id === blocksetId);
  }

  open(
    blocksetId: string
  ): BlocksetBinding | undefined {
    return this.#bindings.get(blocksetId);
  }

  findOwner(
    blockId: number
  ): BlocksetBinding | undefined {
    return [...this.#bindings.values()].find(
      (binding) => binding.slot.ownsBlockId(blockId)
    );
  }

  access(
    blocksetId: string
  ): BlocksetAccess {
    return this.#bindings.get(blocksetId)?.access.current ??
      BLOCKSET_CAPABILITIES.none;
  }

  entriesGranting(
    capability: BlocksetCapability
  ): BlocksetEntry[] {
    return this.#entries.filter(
      (entry) => this.access(entry.id).has(capability)
    );
  }

  canEditBlock(
    blockId: number
  ): boolean {
    return this.#editableBlockOwner(blockId) !== undefined;
  }

  tileSizeFor(
    blocksetId: string
  ): number | undefined {
    return this.#bindings.get(blocksetId)?.opened.blockset.tileSize;
  }

  nextBlockId(
    blocksetId: string
  ): number | undefined {
    return this.#bindings.get(blocksetId)?.link.nextBlockId;
  }

  freeTile(
    blocksetId: string,
    size: number | undefined
  ): TilePosition | undefined {
    const tileSize = this.tileSizeFor(blocksetId);
    if (tileSize === undefined) {
      return undefined;
    }

    const { atlases, shapes, document } = this.#view;
    const atlas = atlases.get(blocksetId)?.def;
    const occupancy = TileOccupancy.collect(
      document.blocks.getAll(),
      (shapeId) => shapes.get(shapeId),
      blocksetId,
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
    const owner = this.#editableBlockOwner(block.id);
    if (owner === undefined) {
      return false;
    }

    return owner.link.defineBlock(
      this.#alphaModes.resolve(block, owner.definition.id)
    );
  }

  duplicateBlock(
    blockId: number
  ): number | null {
    const owner = this.findOwner(blockId);
    const blocks = [...this.#view.document.blocks.getAll()];
    const index = blocks.findIndex((block) => block.id === blockId);
    if (owner === undefined || index === -1) {
      return null;
    }

    const source = blocks[index];
    const id = owner.link.nextBlockId;
    const defined = this.defineBlock({
      ...source,
      id,
      name: `${source.name} copy`
    });
    if (!defined) {
      return null;
    }
    this.moveBlock(id, index + 1);

    return id;
  }

  syncAlphaModes(
    blocksetId: string,
    bounds?: SelectionRect
  ): void {
    for (const block of this.#alphaModes.staleIn(blocksetId, bounds)) {
      this.#editableBlockOwner(block.id)?.link.defineBlock(block);
    }
  }

  removeBlock(
    blockId: number
  ): boolean {
    return this.#editableBlockOwner(blockId)?.link.removeBlock(blockId) ?? false;
  }

  moveBlock(
    blockId: number,
    toIndex: number
  ): boolean {
    return this.#editableBlockOwner(blockId)?.link.moveBlock(blockId, toIndex) ?? false;
  }

  defineMaterialGroup(
    group: MaterialGroup
  ): boolean {
    return this.#findMaterialGroupOwner(group.id)?.link
      .defineMaterialGroup(group.toJSON()) ?? false;
  }

  removeMaterialGroup(
    groupId: string
  ): boolean {
    return this.#findMaterialGroupOwner(groupId)?.link
      .removeMaterialGroup(groupId) ?? false;
  }

  renameMaterialGroup(
    groupId: string,
    to: string
  ): boolean {
    return this.#findMaterialGroupOwner(groupId)?.link
      .renameMaterialGroup(groupId, to) ?? false;
  }

  resizeTiles(
    blocksetId: string,
    tileSize: number
  ): boolean {
    const binding = this.#bindings.get(blocksetId);

    return binding !== undefined &&
      binding.access.current.has("tileSize") &&
      binding.opened.blockset.resizeTiles(tileSize);
  }

  linkableAssets(): AssetRecordData[] {
    const linked = new Set(this.#entries.map((entry) => entry.assetId));

    return [...this.#catalog.records()]
      .filter((record) => BlocksetEntry.isBlocksetAsset(record) && !linked.has(record.id))
      .sort((left, right) => left.source.localeCompare(right.source));
  }

  async create(
    options: CreateBlocksetOptions
  ): Promise<string | null> {
    const assetId = await createBlocksetAsset(
      this.#catalog,
      `${kBlocksetDirectory}${options.name.trim()}${BLOCKSET_EXTENSION}`,
      createBlocksetDocument({
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
    const blocksetId = this.#uniqueBlocksetId();
    const added = this.#view.document.addBlockset({
      id: blocksetId,
      asset: blocksetAsset(assetId)
    });

    return added ? blocksetId : null;
  }

  remove(
    blocksetId: string
  ): boolean {
    return this.#view.document.removeBlockset(blocksetId);
  }

  async rename(
    blocksetId: string,
    name: string
  ): Promise<void> {
    const assetId = this.entry(blocksetId)?.assetId ?? null;
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
    const entries = BlocksetEntry.resolveAll(
      this.#view.document.blocksets,
      this.#catalog.records()
    );
    if (
      entries.length === this.#entries.length &&
      entries.every((entry, index) => entry.equals(this.#entries[index]))
    ) {
      return;
    }

    this.#entries = entries;
    const active = this.#activeBlocksetId;
    if (active === null || this.entry(active) === undefined) {
      this.#assignActive(entries[0]?.id ?? null);
    }
    this.#reconcileBindings();
    this.emit("change");
  };

  dispose(): void {
    this.#unsubscribe();
    this.#catalog.off("change", this.refresh);
    for (const [blocksetId, binding] of this.#bindings) {
      this.#unbind(blocksetId, binding);
    }
  }

  #assignActive(
    blocksetId: string | null
  ): void {
    if (blocksetId !== this.#activeBlocksetId) {
      this.#activeBlocksetId = blocksetId;
      this.emit("activeChange", blocksetId);
    }
  }

  #reconcileBindings(): void {
    const entries = new Map(
      this.#entries.map((entry) => [entry.id, entry])
    );
    for (const [blocksetId, binding] of this.#bindings) {
      const entry = entries.get(blocksetId);
      if (entry === undefined || !binding.boundTo(entry)) {
        this.#unbind(blocksetId, binding);
      }
    }

    for (const [blocksetId, entry] of entries) {
      const binding = this.#bindings.get(blocksetId);
      if (binding === undefined) {
        this.#bind(entry);
      }
      else {
        binding.update(entry.definition);
      }
    }
  }

  #bind(
    entry: BlocksetEntry
  ): void {
    const { definition, assetId } = entry;
    if (definition.slot === undefined || assetId === null) {
      return;
    }

    let opened: OpenedBlockset;
    try {
      opened = this.#open(assetId);
    }
    catch (error) {
      console.error(
        `MapBlocksets: cannot open blockset "${definition.id}"`,
        error
      );

      return;
    }

    const binding = new BlocksetBinding({
      view: this.#view,
      entry,
      slot: new BlocksetSlot({
        id: definition.id,
        slot: definition.slot
      }),
      opened,
      mapDocument: this.#mapDocument,
      blocks: this
    });
    binding.access.on("change", () => this.emit("change"));
    binding.access.on("denied", () => this.emit("denied", definition.id));
    this.#bindings.set(definition.id, binding);
    void opened.ready.then(() => {
      if (this.#bindings.get(definition.id) === binding) {
        this.emit("change");
      }
    });
  }

  #unbind(
    blocksetId: string,
    binding: BlocksetBinding
  ): void {
    this.#bindings.delete(blocksetId);
    binding.dispose();
  }

  #resolveLoadedPixels(
    blocksetId: string
  ): BlocksetPixels | undefined {
    const binding = this.#bindings.get(blocksetId);
    if (binding === undefined || !binding.loaded) {
      return undefined;
    }

    return {
      tileSize: binding.opened.blockset.tileSize,
      pixels: binding.opened.pixels
    };
  }

  #editableBlockOwner(
    blockId: number
  ): BlocksetBinding | undefined {
    const owner = this.findOwner(blockId);

    return owner?.access.current.has("blocks") ? owner : undefined;
  }

  #findMaterialGroupOwner(
    groupId: string
  ): BlocksetBinding | undefined {
    const owner = [...this.#bindings.values()].find(
      (binding) => binding.slot.decodeLocalGroupId(groupId) !== null
    );

    return owner?.access.current.has("materials") ? owner : undefined;
  }

  #uniqueBlocksetId(): string {
    const taken = this.#view.document.blocksets.ids();
    let blocksetId = this.#generateId();
    while (taken.has(blocksetId)) {
      blocksetId = this.#generateId();
    }

    return blocksetId;
  }
}
