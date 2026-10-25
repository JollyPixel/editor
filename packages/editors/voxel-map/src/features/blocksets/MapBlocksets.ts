// Import Third-party Dependencies
import {
  AssetPath,
  type AssetRecordData
} from "@jolly-pixel/asset";
import type { CatalogCreateOptions } from "@jolly-pixel/asset-server/client";
import {
  createBlocksetAsset,
  createBlocksetFile,
  blocksetAsset,
  BLOCKSET_EXTENSION
} from "@jolly-pixel/asset.voxel-map/client";
import type {
  BlockDefinition,
  MaterialGroup,
  VoxelView
} from "@jolly-pixel/voxel.renderer";
import type { SelectionRect } from "@jolly-pixel/pixel-draw.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { EditorMap } from "../../map/EditorMap.ts";
import {
  BLOCKSET_CAPABILITIES,
  type BlocksetAccess,
  type BlocksetCapability
} from "../../access/BlocksetAccess.ts";
import {
  BlockAlphaModes,
  type BlocksetPixels
} from "./BlockAlphaModes.ts";
import { BlocksetEntry } from "../../viewer/BlocksetEntry.ts";
import type { LinkedBlockset } from "../../viewer/LinkedBlockset.ts";
import {
  LinkedBlocksets,
  type BlocksetRecords
} from "../../viewer/LinkedBlocksets.ts";
import type { OpenedBlockset } from "../../viewer/openBlockset.ts";
import {
  BlocksetBinding,
  type BlockWriter
} from "./BlocksetBinding.ts";
import {
  TileOccupancy,
  type TilePosition
} from "./TileOccupancy.ts";

// CONSTANTS
const kBlocksetDirectory = "blocksets/";

export interface BlocksetCatalog extends BlocksetRecords {
  record(assetId: string): AssetRecordData | undefined;
  create(
    path: string,
    content: Uint8Array,
    options?: CatalogCreateOptions
  ): Promise<string>;
  rename(assetId: string, to: string): Promise<void>;
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
  editorMap: EditorMap;
  open: (assetId: string) => OpenedBlockset;
  generateId?: () => string;
}

export type MapBlocksetsEvents = {
  change: () => void;
  activeChange: (blocksetId: string | null) => void;
  denied: (blocksetId: string) => void;
};

export type MapBlocksetsSignals = Pick<
  Emitter<MapBlocksetsEvents>,
  "subscribe"
>;

export class MapBlocksets
  extends Emitter<MapBlocksetsEvents>
  implements BlockWriter {
  readonly #view: VoxelView;
  readonly #catalog: BlocksetCatalog;
  readonly #editorMap: EditorMap;
  readonly #generateId: () => string;
  readonly #linked: LinkedBlocksets;
  readonly #bindings = new Map<string, BlocksetBinding>();
  readonly #alphaModes: BlockAlphaModes;
  readonly #detach: () => void;
  #activeBlocksetId: string | null = null;

  constructor(
    options: MapBlocksetsOptions
  ) {
    super();
    this.#view = options.view;
    this.#catalog = options.catalog;
    this.#editorMap = options.editorMap;
    this.#generateId = options.generateId ?? (() => crypto.randomUUID());
    this.#alphaModes = new BlockAlphaModes({
      view: this.#view,
      resolvePixels: (blocksetId) => this.#resolveLoadedPixels(blocksetId)
    });

    this.#linked = new LinkedBlocksets({
      document: this.#view.document,
      catalog: this.#catalog,
      open: options.open,
      onLink: this.#bind
    });
    this.#linked.on("change", this.#onLinkedChange);
    this.#detach = this.#linked.attach(this.#view);
    this.#assignActive(this.entries[0]?.id ?? null);
  }

  get entries(): readonly BlocksetEntry[] {
    return this.#linked.entries;
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

  get active(): BlocksetEntry | undefined {
    const blocksetId = this.#activeBlocksetId;

    return blocksetId === null ? undefined : this.entry(blocksetId);
  }

  entry(
    blocksetId: string
  ): BlocksetEntry | undefined {
    return this.entries.find((entry) => entry.id === blocksetId);
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
    return this.entries.filter(
      (entry) => this.access(entry.id).has(capability)
    );
  }

  canEditBlock(
    blockId: number
  ): boolean {
    return this.#editableBlockOwner(blockId) !== undefined;
  }

  blocksetTileSize(
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
    const tileSize = this.blocksetTileSize(blocksetId);
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
    const linked = new Set(this.entries.map((entry) => entry.assetId));

    return [...this.#catalog.records()]
      .filter((record) => BlocksetEntry.isBlocksetAsset(record) && !linked.has(record.id))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  async create(
    options: CreateBlocksetOptions
  ): Promise<string | null> {
    const assetId = await createBlocksetAsset(
      this.#catalog,
      `${kBlocksetDirectory}${options.name.trim()}${BLOCKSET_EXTENSION}`,
      createBlocksetFile({
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

    const to = new AssetPath(record.path)
      .withName(trimmed)
      .toString();
    if (to !== record.path) {
      await this.#catalog.rename(record.id, to);
    }
  }

  dispose(): void {
    this.#detach();
    this.#linked.dispose();
  }

  #assignActive(
    blocksetId: string | null
  ): void {
    if (blocksetId !== this.#activeBlocksetId) {
      this.#activeBlocksetId = blocksetId;
      this.emit("activeChange", blocksetId);
    }
  }

  readonly #onLinkedChange = (): void => {
    const active = this.#activeBlocksetId;
    if (active === null || this.entry(active) === undefined) {
      this.#assignActive(this.entries[0]?.id ?? null);
    }
    this.emit("change");
  };

  readonly #bind = (
    linked: LinkedBlockset
  ): () => void => {
    const blocksetId = linked.definition.id;
    const binding = new BlocksetBinding({
      linked,
      shapes: this.#view.shapes,
      editorMap: this.#editorMap,
      blocks: this
    });
    binding.access.on("change", () => this.emit("change"));
    binding.access.on("denied", () => this.emit("denied", blocksetId));
    this.#bindings.set(blocksetId, binding);

    return () => {
      this.#bindings.delete(blocksetId);
      binding.dispose();
    };
  };

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
