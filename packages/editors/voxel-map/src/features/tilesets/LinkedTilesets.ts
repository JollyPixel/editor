// Import Third-party Dependencies
import {
  composeBlockId,
  localBlockIdOf,
  localMaterialGroupId,
  localTilesetBlock,
  resolveBlockDefinition,
  tilesetSlotOf,
  type BlockDefinition,
  type MaterialGroup,
  type TilesetDefinition,
  type TilesetProjection as TilesetSlot,
  type VoxelEngine
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocument } from "../../document/index.ts";
import type {
  TilesetEntry,
  TilesetStore
} from "../../state/index.ts";
import { TilesetAtlasBridge } from "../texture/bridge/TilesetAtlasBridge.ts";
import { TilesetProjection } from "./TilesetProjection.ts";
import type {
  OpenedTileset,
  TilesetSources
} from "./TilesetSources.ts";

export interface LinkedTilesetsOptions {
  engine: VoxelEngine;
  store: TilesetStore;
  sources: TilesetSources;
  mapDocument: MapDocument;
}

/**
 * A tileset linked into the world, with its open document.
 */
export interface LinkedTileset {
  readonly definition: TilesetDefinition;
  readonly slot: TilesetSlot;
  readonly opened: OpenedTileset;
}

/**
 * Writes block definitions in world space; the owning tileset receives
 * them in its own space.
 */
export interface BlockWriter {
  defineBlock(block: BlockDefinition): void;
  defineBlocks(blocks: Iterable<BlockDefinition>): void;
}

export type LinkedTilesetsEvents = {
  change: () => void;
};

interface Binding extends LinkedTileset {
  readonly assetId: string | null;
  readonly bridge: TilesetAtlasBridge;
  readonly projection: TilesetProjection;
}

/**
 * The tilesets linked into the world, each with its leased document, its
 * atlas bridge and its projection into the engine. Block and material
 * group writes addressed in world space are routed to the owning tileset.
 */
export class LinkedTilesets
  extends Emitter<LinkedTilesetsEvents>
  implements BlockWriter {
  readonly #engine: VoxelEngine;
  readonly #store: TilesetStore;
  readonly #sources: TilesetSources;
  readonly #mapDocument: MapDocument;
  readonly #bindings = new Map<string, Binding>();
  readonly #unsubscribe: () => void;

  constructor(
    options: LinkedTilesetsOptions
  ) {
    super();
    this.#engine = options.engine;
    this.#store = options.store;
    this.#sources = options.sources;
    this.#mapDocument = options.mapDocument;

    this.#unsubscribe = this.#store.subscribe("change", this.reconcile);
    this.reconcile();
  }

  has(
    tilesetId: string
  ): boolean {
    return this.#bindings.has(tilesetId);
  }

  open(
    tilesetId: string
  ): LinkedTileset | undefined {
    return this.#bindings.get(tilesetId);
  }

  ownerOf(
    blockId: number
  ): LinkedTileset | undefined {
    const slot = tilesetSlotOf(blockId);
    for (const binding of this.#bindings.values()) {
      if (binding.slot.slot === slot) {
        return binding;
      }
    }

    return undefined;
  }

  materialGroupOwnerOf(
    groupId: string
  ): LinkedTileset | undefined {
    for (const binding of this.#bindings.values()) {
      if (localMaterialGroupId(binding.slot, groupId) !== groupId) {
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

  /**
   * The world id the next block of a tileset receives.
   */
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

  defineBlock(
    block: BlockDefinition
  ): boolean {
    const resolved = resolveBlockDefinition(block);
    const owner = this.ownerOf(resolved.id);
    if (owner === undefined) {
      return false;
    }

    return owner.opened.tileset.defineBlock(
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

  /**
   * Moves a block to a position given in engine order; the tileset keeps
   * the order of its own blocks.
   */
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
    for (const block of this.#engine.blockRegistry) {
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
    const owner = this.materialGroupOwnerOf(group.id);
    if (owner === undefined) {
      return false;
    }

    return owner.opened.tileset.defineMaterialGroup({
      ...group.toJSON(),
      id: localMaterialGroupId(owner.slot, group.id)
    });
  }

  removeMaterialGroup(
    groupId: string
  ): boolean {
    const owner = this.materialGroupOwnerOf(groupId);

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

  readonly reconcile = (): void => {
    const entries = new Map(
      this.#store.entries.map((entry) => [entry.definition.id, entry])
    );
    let changed = false;
    for (const [tilesetId, binding] of this.#bindings) {
      const entry = entries.get(tilesetId);
      if (entry === undefined || !isBoundTo(binding, entry)) {
        this.#unbind(tilesetId, binding);
        changed = true;
      }
    }

    for (const [tilesetId, entry] of entries) {
      const binding = this.#bindings.get(tilesetId);
      if (binding === undefined) {
        changed = this.#bind(entry) || changed;
      }
      else {
        binding.bridge.update(entry.definition);
      }
    }

    if (changed) {
      this.emit("change");
    }
  };

  dispose(): void {
    this.#unsubscribe();
    for (const [tilesetId, binding] of this.#bindings) {
      this.#unbind(tilesetId, binding);
    }
  }

  #bind(
    entry: TilesetEntry
  ): boolean {
    const { definition } = entry;
    if (definition.slot === undefined) {
      return false;
    }

    let opened: OpenedTileset | null;
    try {
      opened = this.#sources.open(entry);
    }
    catch (error) {
      console.error(
        `LinkedTilesets: cannot open tileset "${definition.id}"`,
        error
      );

      return false;
    }
    if (opened === null) {
      return false;
    }

    const slot: TilesetSlot = {
      id: definition.id,
      slot: definition.slot
    };
    const projection = new TilesetProjection({
      engine: this.#engine,
      tileset: opened.tileset,
      slot
    });
    const bridge = new TilesetAtlasBridge({
      engine: this.#engine,
      pixels: opened.pixels,
      tileset: opened.tileset,
      definition,
      mapDocument: this.#mapDocument,
      blocks: this
    });
    this.#bindings.set(definition.id, {
      definition,
      slot,
      opened,
      assetId: entry.assetId,
      bridge,
      projection
    });
    void opened.ready.then(() => {
      if (this.#bindings.get(definition.id)?.opened === opened) {
        this.emit("change");
      }
    });

    return true;
  }

  #unbind(
    tilesetId: string,
    binding: Binding
  ): void {
    this.#bindings.delete(tilesetId);
    binding.bridge.destroy();
    binding.projection.dispose();
    binding.opened.release();
  }
}

function isBoundTo(
  binding: Binding,
  entry: TilesetEntry
): boolean {
  return binding.assetId === entry.assetId &&
    binding.slot.slot === entry.definition.slot;
}
