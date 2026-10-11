// Import Internal Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition
} from "../blocks/BlockDefinition.ts";
import type { MaterialGroupJSON } from "../materials/MaterialGroup.ts";
import type { BlocksetDocumentCommand } from "../commands/types.ts";
import type { VoxelDocument } from "../VoxelDocument.ts";
import type { BlocksetDocument } from "./BlocksetDocument.ts";
import type { BlocksetSlot } from "./BlocksetSlot.ts";

export type BlocksetLinkTarget = Pick<
  VoxelDocument,
  | "blocks"
  | "materialGroups"
  | "blendGroups"
  | "defineBlock"
  | "defineBlocks"
  | "removeBlock"
  | "moveBlock"
  | "defineMaterialGroup"
  | "removeMaterialGroup"
  | "defineBlendGroup"
  | "removeBlendGroup"
>;

export interface BlocksetLinkOptions {
  document: BlocksetLinkTarget;
  blockset: BlocksetDocument;
  slot: BlocksetSlot;
}

export class BlocksetLink {
  readonly slot: BlocksetSlot;
  readonly blockset: BlocksetDocument;

  readonly #document: BlocksetLinkTarget;

  readonly #onLoaded = (): void => {
    this.#projectAll();
  };

  readonly #onCommand = (
    command: BlocksetDocumentCommand
  ): void => {
    this.#apply(command);
  };

  constructor(
    options: BlocksetLinkOptions
  ) {
    this.#document = options.document;
    this.blockset = options.blockset;
    this.slot = options.slot;

    this.blockset.on("loaded", this.#onLoaded);
    this.blockset.on("command", this.#onCommand);
    this.#projectAll();
  }

  get nextBlockId(): number {
    return this.slot.composeBlockId(this.blockset.blocks.nextId);
  }

  defineBlock(
    block: BlockDefinition
  ): boolean {
    return this.blockset.defineBlock(
      this.slot.localizeBlock(resolveBlockDefinition(block))
    );
  }

  removeBlock(
    blockId: number
  ): boolean {
    return this.blockset.removeBlock(this.slot.decodeLocalBlockId(blockId));
  }

  moveBlock(
    blockId: number,
    toIndex: number
  ): boolean {
    let localIndex = 0;
    let index = 0;
    for (const block of this.#document.blocks) {
      if (block.id === blockId) {
        continue;
      }
      if (index >= toIndex) {
        break;
      }
      if (this.slot.ownsBlockId(block.id)) {
        localIndex++;
      }
      index++;
    }

    return this.blockset.moveBlock(this.slot.decodeLocalBlockId(blockId), localIndex);
  }

  defineMaterialGroup(
    group: MaterialGroupJSON
  ): boolean {
    return this.blockset.defineMaterialGroup(this.slot.localizeMaterialGroup(group));
  }

  removeMaterialGroup(
    groupId: string
  ): boolean {
    const localId = this.slot.decodeLocalGroupId(groupId);

    return localId !== null && this.blockset.removeMaterialGroup(localId);
  }

  renameMaterialGroup(
    groupId: string,
    to: string
  ): boolean {
    const localId = this.slot.decodeLocalGroupId(groupId);
    const localTo = this.slot.decodeLocalGroupId(to);

    return localId !== null &&
      localTo !== null &&
      this.blockset.renameMaterialGroup(localId, localTo);
  }

  dispose(): void {
    this.blockset.off("loaded", this.#onLoaded);
    this.blockset.off("command", this.#onCommand);
    this.#unprojectAll();
  }

  #projectAll(): void {
    const document = this.#document;
    const { blocks, materialGroups, blendGroups } = this.blockset;

    for (const block of [...document.blocks]) {
      if (
        this.slot.ownsBlockId(block.id) &&
        !blocks.has(this.slot.decodeLocalBlockId(block.id))
      ) {
        document.removeBlock(block.id);
      }
    }
    for (const group of [...document.materialGroups]) {
      const localId = this.slot.decodeLocalGroupId(group.id);
      if (localId !== null && !materialGroups.has(localId)) {
        document.removeMaterialGroup(group.id);
      }
    }
    for (const group of materialGroups) {
      document.defineMaterialGroup(
        this.slot.projectMaterialGroup(group.toJSON())
      );
    }
    for (const group of [...document.blendGroups]) {
      const localId = this.slot.decodeLocalGroupId(group.id);
      if (localId !== null && !blendGroups.has(localId)) {
        document.removeBlendGroup(group.id);
      }
    }
    for (const group of blendGroups) {
      document.defineBlendGroup(this.slot.projectBlendGroup(group.toJSON()));
    }
    document.defineBlocks(this.slot.projectBlocks(blocks));
  }

  #unprojectAll(): void {
    const document = this.#document;

    for (const block of [...document.blocks]) {
      if (this.slot.ownsBlockId(block.id)) {
        document.removeBlock(block.id);
      }
    }
    for (const group of [...document.materialGroups]) {
      if (this.slot.decodeLocalGroupId(group.id) !== null) {
        document.removeMaterialGroup(group.id);
      }
    }
    for (const group of [...document.blendGroups]) {
      if (this.slot.decodeLocalGroupId(group.id) !== null) {
        document.removeBlendGroup(group.id);
      }
    }
  }

  #apply(
    command: BlocksetDocumentCommand
  ): void {
    const document = this.#document;
    switch (command.action) {
      case "block-defined":
        document.defineBlock(this.slot.projectBlock(command.block));
        break;
      case "block-removed":
        document.removeBlock(this.slot.composeBlockId(command.blockId));
        break;
      case "block-moved":
        document.moveBlock(
          this.slot.composeBlockId(command.blockId),
          this.#findDocumentIndex(command.toIndex)
        );
        break;
      case "material-group-defined":
        document.defineMaterialGroup(
          this.slot.projectMaterialGroup(command.group)
        );
        break;
      case "material-group-removed":
        document.removeMaterialGroup(this.slot.qualifyGroupId(command.groupId));
        break;
      case "blend-group-defined":
        document.defineBlendGroup(this.slot.projectBlendGroup(command.group));
        break;
      case "blend-group-removed":
        document.removeBlendGroup(this.slot.qualifyGroupId(command.groupId));
        break;
      case "tile-size-updated":
        document.defineBlocks(this.slot.projectBlocks(this.blockset.blocks));
        break;
      case "material-group-renamed":
        this.#renameMaterialGroup(command.groupId, command.to);
        break;
      default: {
        const unhandled: never = command;
        throw new Error(
          `BlocksetLink: unhandled action '${(unhandled as BlocksetDocumentCommand).action}'.`
        );
      }
    }
  }

  #renameMaterialGroup(
    groupId: string,
    to: string
  ): void {
    const document = this.#document;
    const { blocks, materialGroups } = this.blockset;

    const group = materialGroups.get(to);
    if (group !== undefined) {
      document.defineMaterialGroup(
        this.slot.projectMaterialGroup(group.toJSON())
      );
    }
    document.defineBlocks(this.slot.projectBlocks(
      [...blocks].filter((block) => block.materialGroup === to)
    ));
    document.removeMaterialGroup(this.slot.qualifyGroupId(groupId));
  }

  #findDocumentIndex(
    localIndex: number
  ): number {
    const positions: number[] = [];
    let index = 0;
    for (const block of this.#document.blocks) {
      if (this.slot.ownsBlockId(block.id)) {
        positions.push(index);
      }
      index++;
    }

    return positions[localIndex] ?? positions[positions.length - 1] ?? 0;
  }
}
