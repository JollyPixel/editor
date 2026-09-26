// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { applyBlockCommand } from "../blocks/applyBlockCommand.ts";
import {
  isLocalBlockId,
  MAX_LOCAL_BLOCK_ID
} from "../blocks/BlockId.ts";
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type ResolvedBlockDefinition
} from "../blocks/BlockDefinition.ts";
import { BlockRegistry } from "../blocks/BlockRegistry.ts";
import { BlockTextures } from "../blocks/BlockTextures.ts";
import type {
  TilesetDocumentCommand,
  VoxelCommandContext,
  VoxelCommandOrigin
} from "../commands/types.ts";
import {
  applyMaterialGroupCommand
} from "../materials/applyMaterialGroupCommand.ts";
import {
  MaterialGroup,
  type MaterialGroupJSON
} from "../materials/MaterialGroup.ts";
import { MaterialGroupList } from "../materials/MaterialGroupList.ts";
import { rescaleTileRef } from "./tileRef.ts";
import {
  DEFAULT_TILE_SIZE,
  isTileSize
} from "./tileSize.ts";
import type { ResolvedTileRef } from "./types.ts";

export interface TilesetDocumentJSON {
  tileSize: number;
  blocks: ResolvedBlockDefinition[];
  materialGroups: MaterialGroupJSON[];
}

export interface TilesetDocumentOptions {
  /**
   * @default 32
   */
  tileSize?: number;
  blocks?: Iterable<BlockDefinition>;
  materialGroups?: Iterable<MaterialGroupJSON>;
}

export interface TilesetApplyOptions {
  /**
   * @default "local"
   */
  origin?: VoxelCommandOrigin;
}

export type TilesetDocumentListener = (
  command: TilesetDocumentCommand,
  context: VoxelCommandContext
) => void;

export type TilesetDocumentEvents = {
  command: TilesetDocumentListener;
  loaded: () => void;
};

/**
 * The blocks, material groups and tile size of one tileset. Tile references
 * name no tileset: they are relative to the tileset's own atlas, and block
 * ids are local to it until a world projects them into a slot.
 */
export class TilesetDocument extends Emitter<TilesetDocumentEvents> {
  readonly blocks: BlockRegistry;
  readonly materialGroups: MaterialGroupList;

  #tileSize: number;

  constructor(
    options: TilesetDocumentOptions = {}
  ) {
    super();
    const {
      tileSize = DEFAULT_TILE_SIZE,
      blocks = [],
      materialGroups = []
    } = options;
    if (!isTileSize(tileSize)) {
      throw new RangeError(`Invalid tile size ${tileSize}.`);
    }

    this.#tileSize = tileSize;
    this.blocks = new BlockRegistry(
      Array.from(blocks, localBlock)
    );
    this.materialGroups = new MaterialGroupList(materialGroups);
  }

  get tileSize(): number {
    return this.#tileSize;
  }

  apply(
    command: TilesetDocumentCommand,
    options: TilesetApplyOptions = {}
  ): boolean {
    const { origin = "local" } = options;

    const applied = this.#fold(command);
    if (applied === null) {
      return false;
    }
    this.emit("command", applied, { origin });

    return true;
  }

  defineBlock(
    def: BlockDefinition
  ): boolean {
    return this.apply({
      action: "block-defined",
      block: localBlock(def)
    });
  }

  defineBlocks(
    defs: Iterable<BlockDefinition>
  ): void {
    for (const def of defs) {
      this.defineBlock(def);
    }
  }

  removeBlock(
    blockId: number
  ): boolean {
    return this.apply({
      action: "block-removed",
      blockId
    });
  }

  moveBlock(
    blockId: number,
    toIndex: number
  ): boolean {
    return this.apply({
      action: "block-moved",
      blockId,
      toIndex
    });
  }

  defineMaterialGroup(
    group: MaterialGroup | MaterialGroupJSON
  ): boolean {
    return this.apply({
      action: "material-group-defined",
      group: group instanceof MaterialGroup ? group.toJSON() : group
    });
  }

  removeMaterialGroup(
    groupId: string
  ): boolean {
    return this.apply({
      action: "material-group-removed",
      groupId
    });
  }

  resizeTiles(
    tileSize: number
  ): boolean {
    return this.apply({
      action: "tile-size-updated",
      tileSize
    });
  }

  toJSON(): TilesetDocumentJSON {
    return {
      tileSize: this.#tileSize,
      blocks: [...this.blocks],
      materialGroups: this.materialGroups.toJSON()
    };
  }

  load(
    data: TilesetDocumentJSON
  ): void {
    if (!isTileSize(data.tileSize)) {
      throw new RangeError(`Invalid tile size ${data.tileSize}.`);
    }
    const blocks = data.blocks.map(localBlock);

    this.#tileSize = data.tileSize;
    this.blocks.clear();
    this.blocks.registerMany(blocks);
    this.materialGroups.replace(data.materialGroups);
    this.emit("loaded");
  }

  clear(
    tileSize: number = DEFAULT_TILE_SIZE
  ): void {
    this.load({
      tileSize,
      blocks: [],
      materialGroups: []
    });
  }

  dispose(): void {
    this.removeAllListeners();
  }

  #fold(
    command: TilesetDocumentCommand
  ): TilesetDocumentCommand | null {
    switch (command.action) {
      case "block-defined":
        return applyBlockCommand(
          this.blocks,
          { ...command, block: localBlock(command.block) },
          null
        );
      case "block-removed":
      case "block-moved":
        return applyBlockCommand(this.blocks, command, null);
      case "material-group-defined":
      case "material-group-removed":
        return applyMaterialGroupCommand(this.materialGroups, command);
      case "tile-size-updated":
        return this.#resizeTiles(command.tileSize) ? command : null;
      default: {
        const unhandled: never = command;
        throw new Error(
          `TilesetDocument: unhandled action '${(unhandled as TilesetDocumentCommand).action}'.`
        );
      }
    }
  }

  #resizeTiles(
    tileSize: number
  ): boolean {
    const from = this.#tileSize;
    if (!isTileSize(tileSize) || tileSize === from) {
      return false;
    }

    this.#tileSize = tileSize;
    const rescale = {
      tilesetId: undefined,
      from,
      to: tileSize
    };
    const rescaled: ResolvedBlockDefinition[] = [];
    for (const block of this.blocks) {
      const next = BlockTextures.of(block)
        .map((ref) => rescaleTileRef(ref, rescale))
        .applyTo(block);
      if (next !== block) {
        rescaled.push(next);
      }
    }
    this.blocks.registerMany(rescaled);

    return true;
  }
}

export function localBlock(
  def: BlockDefinition
): ResolvedBlockDefinition {
  if (!isLocalBlockId(def.id)) {
    throw new RangeError(
      `Block id ${def.id} is out of range (1..${MAX_LOCAL_BLOCK_ID}).`
    );
  }
  const resolved = resolveBlockDefinition(def);

  return BlockTextures.of(resolved)
    .map(withoutTileset)
    .applyTo(resolved);
}

function withoutTileset(
  ref: ResolvedTileRef
): ResolvedTileRef {
  if (ref.tilesetId === undefined) {
    return ref;
  }

  const { tilesetId: _tilesetId, ...local } = ref;

  return local;
}
