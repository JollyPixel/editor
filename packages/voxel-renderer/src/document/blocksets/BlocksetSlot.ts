// Import Internal Dependencies
import {
  composeBlockId,
  isBlocksetSlot,
  decodeLocalBlockId,
  MAX_BLOCKSET_SLOT,
  decodeBlocksetSlot
} from "../blocks/BlockId.ts";
import type { ResolvedBlockDefinition } from "../blocks/BlockDefinition.ts";
import { BlockTextures } from "../blocks/BlockTextures.ts";
import type { MaterialGroupJSON } from "../materials/MaterialGroup.ts";
import type { BlendGroupJSON } from "../materials/BlendGroup.ts";
import { withoutBlocksets } from "./localBlock.ts";

// CONSTANTS
const kGroupSeparator = "/";

export interface BlocksetSlotJSON {
  id: string;
  slot: number;
}

export class BlocksetSlot {
  readonly id: string;
  readonly slot: number;

  constructor(
    options: BlocksetSlotJSON
  ) {
    if (!isBlocksetSlot(options.slot)) {
      throw new RangeError(
        `Blockset slot ${options.slot} is out of range (0..${MAX_BLOCKSET_SLOT}).`
      );
    }

    this.id = options.id;
    this.slot = options.slot;
  }

  ownsBlockId(
    blockId: number
  ): boolean {
    return decodeBlocksetSlot(blockId) === this.slot;
  }

  composeBlockId(
    localId: number
  ): number {
    return composeBlockId(this.slot, localId);
  }

  decodeLocalBlockId(
    blockId: number
  ): number {
    return decodeLocalBlockId(blockId);
  }

  qualifyGroupId(
    localId: string
  ): string {
    return `${this.#groupPrefix}${localId}`;
  }

  decodeLocalGroupId(
    groupId: string
  ): string | null {
    const prefix = this.#groupPrefix;

    return groupId.startsWith(prefix) ? groupId.slice(prefix.length) : null;
  }

  projectBlock(
    block: ResolvedBlockDefinition
  ): ResolvedBlockDefinition {
    const projected = BlockTextures.fromBlock(block)
      .map((ref) => (
        ref.blocksetId === this.id ?
          ref :
          {
            ...ref,
            blocksetId: this.id
          }
      ))
      .createTexturedBlock(block);

    return {
      ...projected,
      id: this.composeBlockId(block.id),
      ...(block.materialGroup === undefined ? {} : {
        materialGroup: this.qualifyGroupId(block.materialGroup)
      }),
      ...(block.blendGroup === undefined ? {} : {
        blendGroup: this.qualifyGroupId(block.blendGroup)
      })
    };
  }

  projectBlocks(
    blocks: Iterable<ResolvedBlockDefinition>
  ): ResolvedBlockDefinition[] {
    return Array.from(blocks, (block) => this.projectBlock(block));
  }

  localizeBlock(
    block: ResolvedBlockDefinition
  ): ResolvedBlockDefinition {
    return {
      ...withoutBlocksets(block),
      id: this.decodeLocalBlockId(block.id),
      ...(block.materialGroup === undefined ? {} : {
        materialGroup: this.decodeLocalGroupId(block.materialGroup) ??
          block.materialGroup
      }),
      ...(block.blendGroup === undefined ? {} : {
        blendGroup: this.decodeLocalGroupId(block.blendGroup) ?? block.blendGroup
      })
    };
  }

  projectMaterialGroup(
    group: MaterialGroupJSON
  ): MaterialGroupJSON {
    return {
      ...group,
      id: this.qualifyGroupId(group.id)
    };
  }

  localizeMaterialGroup(
    group: MaterialGroupJSON
  ): MaterialGroupJSON {
    return {
      ...group,
      id: this.decodeLocalGroupId(group.id) ?? group.id
    };
  }

  projectBlendGroup(
    group: BlendGroupJSON
  ): BlendGroupJSON {
    return {
      ...group,
      id: this.qualifyGroupId(group.id),
      ...(group.exclude === undefined ? {} : {
        exclude: group.exclude.map((id) => this.qualifyGroupId(id))
      })
    };
  }

  equals(
    other: BlocksetSlot
  ): boolean {
    return this.id === other.id && this.slot === other.slot;
  }

  toJSON(): BlocksetSlotJSON {
    return {
      id: this.id,
      slot: this.slot
    };
  }

  get #groupPrefix(): string {
    return `${this.id}${kGroupSeparator}`;
  }
}
