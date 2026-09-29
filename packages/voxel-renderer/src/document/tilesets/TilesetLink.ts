// Import Internal Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition
} from "../blocks/BlockDefinition.ts";
import type { MaterialGroupJSON } from "../materials/MaterialGroup.ts";
import type { TilesetDocumentCommand } from "../commands/types.ts";
import type { VoxelDocument } from "../VoxelDocument.ts";
import type { TilesetDocument } from "./TilesetDocument.ts";
import type { TilesetSlot } from "./TilesetSlot.ts";

export type TilesetLinkTarget = Pick<
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

export interface TilesetLinkOptions {
  document: TilesetLinkTarget;
  tileset: TilesetDocument;
  slot: TilesetSlot;
}

export class TilesetLink {
  readonly slot: TilesetSlot;
  readonly tileset: TilesetDocument;

  readonly #document: TilesetLinkTarget;

  readonly #onLoaded = (): void => {
    this.#projectAll();
  };

  readonly #onCommand = (
    command: TilesetDocumentCommand
  ): void => {
    this.#apply(command);
  };

  constructor(
    options: TilesetLinkOptions
  ) {
    this.#document = options.document;
    this.tileset = options.tileset;
    this.slot = options.slot;

    this.tileset.on("loaded", this.#onLoaded);
    this.tileset.on("command", this.#onCommand);
    this.#projectAll();
  }

  get nextBlockId(): number {
    return this.slot.blockId(this.tileset.blocks.nextId);
  }

  defineBlock(
    block: BlockDefinition
  ): boolean {
    return this.tileset.defineBlock(
      this.slot.local(resolveBlockDefinition(block))
    );
  }

  removeBlock(
    blockId: number
  ): boolean {
    return this.tileset.removeBlock(this.slot.localBlockId(blockId));
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
      if (this.slot.owns(block.id)) {
        localIndex++;
      }
      index++;
    }

    return this.tileset.moveBlock(this.slot.localBlockId(blockId), localIndex);
  }

  defineMaterialGroup(
    group: MaterialGroupJSON
  ): boolean {
    return this.tileset.defineMaterialGroup(this.slot.localMaterialGroup(group));
  }

  removeMaterialGroup(
    groupId: string
  ): boolean {
    const localId = this.slot.localGroupId(groupId);

    return localId !== null && this.tileset.removeMaterialGroup(localId);
  }

  dispose(): void {
    this.tileset.off("loaded", this.#onLoaded);
    this.tileset.off("command", this.#onCommand);
    this.#unprojectAll();
  }

  #projectAll(): void {
    const document = this.#document;
    const { blocks, materialGroups, blendGroups } = this.tileset;

    for (const block of [...document.blocks]) {
      if (
        this.slot.owns(block.id) &&
        !blocks.has(this.slot.localBlockId(block.id))
      ) {
        document.removeBlock(block.id);
      }
    }
    for (const group of [...document.materialGroups]) {
      const localId = this.slot.localGroupId(group.id);
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
      const localId = this.slot.localGroupId(group.id);
      if (localId !== null && !blendGroups.has(localId)) {
        document.removeBlendGroup(group.id);
      }
    }
    for (const group of blendGroups) {
      document.defineBlendGroup(this.slot.projectBlendGroup(group.toJSON()));
    }
    document.defineBlocks(this.slot.projectAll(blocks));
  }

  #unprojectAll(): void {
    const document = this.#document;

    for (const block of [...document.blocks]) {
      if (this.slot.owns(block.id)) {
        document.removeBlock(block.id);
      }
    }
    for (const group of [...document.materialGroups]) {
      if (this.slot.localGroupId(group.id) !== null) {
        document.removeMaterialGroup(group.id);
      }
    }
    for (const group of [...document.blendGroups]) {
      if (this.slot.localGroupId(group.id) !== null) {
        document.removeBlendGroup(group.id);
      }
    }
  }

  #apply(
    command: TilesetDocumentCommand
  ): void {
    const document = this.#document;
    switch (command.action) {
      case "block-defined":
        document.defineBlock(this.slot.project(command.block));
        break;
      case "block-removed":
        document.removeBlock(this.slot.blockId(command.blockId));
        break;
      case "block-moved":
        document.moveBlock(
          this.slot.blockId(command.blockId),
          this.#documentIndexOf(command.toIndex)
        );
        break;
      case "material-group-defined":
        document.defineMaterialGroup(
          this.slot.projectMaterialGroup(command.group)
        );
        break;
      case "material-group-removed":
        document.removeMaterialGroup(this.slot.groupId(command.groupId));
        break;
      case "blend-group-defined":
        document.defineBlendGroup(this.slot.projectBlendGroup(command.group));
        break;
      case "blend-group-removed":
        document.removeBlendGroup(this.slot.groupId(command.groupId));
        break;
      case "tile-size-updated":
        document.defineBlocks(this.slot.projectAll(this.tileset.blocks));
        break;
      default: {
        const unhandled: never = command;
        throw new Error(
          `TilesetLink: unhandled action '${(unhandled as TilesetDocumentCommand).action}'.`
        );
      }
    }
  }

  #documentIndexOf(
    localIndex: number
  ): number {
    const positions: number[] = [];
    let index = 0;
    for (const block of this.#document.blocks) {
      if (this.slot.owns(block.id)) {
        positions.push(index);
      }
      index++;
    }

    return positions[localIndex] ?? positions[positions.length - 1] ?? 0;
  }
}
