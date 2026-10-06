// Import Internal Dependencies
import {
  BlockDocument,
  type BlockCatalogCommand,
  type BlockDocumentEvents
} from "../BlockDocument.ts";
import type {
  BlockDefinition,
  ResolvedBlockDefinition
} from "../blocks/BlockDefinition.ts";
import { BlockRegistry } from "../blocks/BlockRegistry.ts";
import { BlockTextures } from "../blocks/BlockTextures.ts";
import type {
  BlocksetDocumentCommand,
  VoxelCommandContext
} from "../commands/types.ts";
import type { MaterialGroupJSON } from "../materials/MaterialGroup.ts";
import { MaterialGroupList } from "../materials/MaterialGroupList.ts";
import type { BlendGroupJSON } from "../materials/BlendGroup.ts";
import { BlendGroupList } from "../materials/BlendGroupList.ts";
import { localBlock } from "./localBlock.ts";
import { rescaleTileRef } from "./tileRef.ts";
import {
  DEFAULT_TILE_SIZE,
  isTileSize
} from "./tileSize.ts";

export interface BlocksetDocumentJSON {
  tileSize: number;
  blocks: ResolvedBlockDefinition[];
  materialGroups: MaterialGroupJSON[];
  /**
   * @default []
   */
  blendGroups?: BlendGroupJSON[];
}

export interface BlocksetDocumentOptions {
  /**
   * Tile edge length in pixels, from 1 to `MAX_TILE_SIZE`.
   * @default 32
   */
  tileSize?: number;

  /**
   * Blocks with blockset-local ids; any blockset id in their tile references
   * is dropped.
   * @default []
   */
  blocks?: Iterable<BlockDefinition>;

  /**
   * Material groups the blocks can name through `materialGroup`.
   * @default []
   */
  materialGroups?: Iterable<MaterialGroupJSON>;

  /**
   * Blend groups the blocks can name through `blendGroup`.
   * @default []
   */
  blendGroups?: Iterable<BlendGroupJSON>;
}

export type BlocksetDocumentListener = (
  command: BlocksetDocumentCommand,
  context: VoxelCommandContext
) => void;

export type BlocksetDocumentEvents = BlockDocumentEvents<BlocksetDocumentCommand>;

/**
 * The blocks, material groups, blend groups and tile size of one blockset.
 * Tile references name no blockset: they are relative to the blockset's own
 * atlas, and block ids are local to it until a world projects them into a
 * slot.
 */
export class BlocksetDocument extends BlockDocument<BlocksetDocumentCommand> {
  #tileSize: number;

  constructor(
    options: BlocksetDocumentOptions = {}
  ) {
    const {
      tileSize = DEFAULT_TILE_SIZE,
      blocks = [],
      materialGroups = [],
      blendGroups = []
    } = options;
    if (!isTileSize(tileSize)) {
      throw new RangeError(`Invalid tile size ${tileSize}.`);
    }
    super(
      new BlockRegistry(Array.from(blocks, localBlock)),
      new MaterialGroupList(materialGroups),
      new BlendGroupList(blendGroups)
    );

    this.#tileSize = tileSize;
  }

  get tileSize(): number {
    return this.#tileSize;
  }

  resizeTiles(
    tileSize: number
  ): boolean {
    return this.apply({
      action: "tile-size-updated",
      tileSize
    });
  }

  toJSON(): BlocksetDocumentJSON {
    return {
      tileSize: this.#tileSize,
      blocks: [...this.blocks],
      materialGroups: this.materialGroups.toJSON(),
      blendGroups: this.blendGroups.toJSON()
    };
  }

  load(
    data: BlocksetDocumentJSON
  ): void {
    if (!isTileSize(data.tileSize)) {
      throw new RangeError(`Invalid tile size ${data.tileSize}.`);
    }
    const blocks = data.blocks.map(localBlock);

    this.#tileSize = data.tileSize;
    this.blocks.clear();
    this.blocks.registerMany(blocks);
    this.materialGroups.replace(data.materialGroups);
    this.blendGroups.replace(data.blendGroups ?? []);
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

  protected fold(
    command: BlocksetDocumentCommand | BlockCatalogCommand
  ): BlocksetDocumentCommand | null {
    switch (command.action) {
      case "block-defined":
        return this.blocks.apply({
          ...command,
          block: localBlock(command.block)
        });
      case "block-removed":
      case "block-moved":
        return this.blocks.apply(command);
      case "material-group-defined":
      case "material-group-removed":
        return this.materialGroups.apply(command);
      case "blend-group-defined":
      case "blend-group-removed":
        return this.blendGroups.apply(command);
      case "tile-size-updated":
        return this.#resizeTiles(command.tileSize) ? command : null;
      default: {
        const unhandled: never = command;
        throw new Error(
          `BlocksetDocument: unhandled action '${(unhandled as BlocksetDocumentCommand).action}'.`
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
      blocksetId: undefined,
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
