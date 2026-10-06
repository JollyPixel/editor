// Import Internal Dependencies
import {
  composeBlockId,
  isBlocksetSlot,
  localBlockIdOf,
  MAX_BLOCKSET_SLOT,
  blocksetSlotOf
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

  owns(
    blockId: number
  ): boolean {
    return blocksetSlotOf(blockId) === this.slot;
  }

  blockId(
    localId: number
  ): number {
    return composeBlockId(this.slot, localId);
  }

  localBlockId(
    blockId: number
  ): number {
    return localBlockIdOf(blockId);
  }

  groupId(
    localId: string
  ): string {
    return `${this.#groupPrefix}${localId}`;
  }

  localGroupId(
    groupId: string
  ): string | null {
    const prefix = this.#groupPrefix;

    return groupId.startsWith(prefix) ? groupId.slice(prefix.length) : null;
  }

  project(
    block: ResolvedBlockDefinition
  ): ResolvedBlockDefinition {
    const projected = BlockTextures.of(block)
      .map((ref) => (
        ref.blocksetId === this.id ?
          ref :
          {
            ...ref,
            blocksetId: this.id
          }
      ))
      .applyTo(block);

    return {
      ...projected,
      id: this.blockId(block.id),
      ...(block.materialGroup === undefined ? {} : {
        materialGroup: this.groupId(block.materialGroup)
      }),
      ...(block.blendGroup === undefined ? {} : {
        blendGroup: this.groupId(block.blendGroup)
      })
    };
  }

  projectAll(
    blocks: Iterable<ResolvedBlockDefinition>
  ): ResolvedBlockDefinition[] {
    return Array.from(blocks, (block) => this.project(block));
  }

  local(
    block: ResolvedBlockDefinition
  ): ResolvedBlockDefinition {
    return {
      ...withoutBlocksets(block),
      id: this.localBlockId(block.id),
      ...(block.materialGroup === undefined ? {} : {
        materialGroup: this.localGroupId(block.materialGroup) ??
          block.materialGroup
      }),
      ...(block.blendGroup === undefined ? {} : {
        blendGroup: this.localGroupId(block.blendGroup) ?? block.blendGroup
      })
    };
  }

  projectMaterialGroup(
    group: MaterialGroupJSON
  ): MaterialGroupJSON {
    return {
      ...group,
      id: this.groupId(group.id)
    };
  }

  localMaterialGroup(
    group: MaterialGroupJSON
  ): MaterialGroupJSON {
    return {
      ...group,
      id: this.localGroupId(group.id) ?? group.id
    };
  }

  projectBlendGroup(
    group: BlendGroupJSON
  ): BlendGroupJSON {
    return {
      ...group,
      id: this.groupId(group.id),
      ...(group.exclude === undefined ? {} : {
        exclude: group.exclude.map((id) => this.groupId(id))
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
