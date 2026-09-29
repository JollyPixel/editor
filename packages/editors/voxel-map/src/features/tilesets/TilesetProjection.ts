// Import Third-party Dependencies
import {
  belongsToTileset,
  composeBlockId,
  localBlockIdOf,
  projectedBlendGroupId,
  projectedMaterialGroupId,
  projectTilesetBlendGroup,
  projectTilesetBlock,
  projectTilesetBlocks,
  projectTilesetMaterialGroup,
  type TilesetDocument,
  type TilesetDocumentCommand,
  type TilesetDocumentListener,
  type TilesetProjection as TilesetSlot,
  type VoxelDocument
} from "@jolly-pixel/voxel.renderer";

export type ProjectionEngine = Pick<
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

export interface TilesetProjectionOptions {
  engine: ProjectionEngine;
  tileset: TilesetDocument;
  slot: TilesetSlot;
}

export class TilesetProjection {
  readonly #engine: ProjectionEngine;
  readonly #tileset: TilesetDocument;
  readonly #slot: TilesetSlot;

  readonly #onLoaded = (): void => {
    this.#projectAll();
  };

  readonly #onCommand: TilesetDocumentListener = (command) => {
    this.#apply(command);
  };

  constructor(
    options: TilesetProjectionOptions
  ) {
    this.#engine = options.engine;
    this.#tileset = options.tileset;
    this.#slot = { ...options.slot };

    this.#tileset.on("loaded", this.#onLoaded);
    this.#tileset.on("command", this.#onCommand);
    this.#projectAll();
  }

  dispose(): void {
    this.#tileset.off("loaded", this.#onLoaded);
    this.#tileset.off("command", this.#onCommand);
    this.#unprojectAll();
  }

  #projectAll(): void {
    const engine = this.#engine;
    const { blocks, materialGroups, blendGroups } = this.#tileset;

    for (const block of [...engine.blocks]) {
      if (
        belongsToTileset(this.#slot, block.id) &&
        !blocks.has(localBlockIdOf(block.id))
      ) {
        engine.removeBlock(block.id);
      }
    }
    for (const group of [...engine.materialGroups]) {
      const local = this.#localGroupId(group.id);
      if (local !== null && !materialGroups.has(local)) {
        engine.removeMaterialGroup(group.id);
      }
    }
    for (const group of materialGroups) {
      engine.defineMaterialGroup(
        projectTilesetMaterialGroup(this.#slot, group.toJSON())
      );
    }
    for (const group of [...engine.blendGroups]) {
      const local = this.#localGroupId(group.id);
      if (local !== null && !blendGroups.has(local)) {
        engine.removeBlendGroup(group.id);
      }
    }
    for (const group of blendGroups) {
      engine.defineBlendGroup(
        projectTilesetBlendGroup(this.#slot, group.toJSON())
      );
    }
    engine.defineBlocks(projectTilesetBlocks(this.#slot, blocks));
  }

  #unprojectAll(): void {
    const engine = this.#engine;

    for (const block of [...engine.blocks]) {
      if (belongsToTileset(this.#slot, block.id)) {
        engine.removeBlock(block.id);
      }
    }
    for (const group of [...engine.materialGroups]) {
      if (this.#localGroupId(group.id) !== null) {
        engine.removeMaterialGroup(group.id);
      }
    }
    for (const group of [...engine.blendGroups]) {
      if (this.#localGroupId(group.id) !== null) {
        engine.removeBlendGroup(group.id);
      }
    }
  }

  #apply(
    command: TilesetDocumentCommand
  ): void {
    const engine = this.#engine;
    switch (command.action) {
      case "block-defined":
        engine.defineBlock(projectTilesetBlock(this.#slot, command.block));
        break;
      case "block-removed":
        engine.removeBlock(composeBlockId(this.#slot.slot, command.blockId));
        break;
      case "block-moved":
        engine.moveBlock(
          composeBlockId(this.#slot.slot, command.blockId),
          this.#engineIndexOf(command.toIndex)
        );
        break;
      case "material-group-defined":
        engine.defineMaterialGroup(
          projectTilesetMaterialGroup(this.#slot, command.group)
        );
        break;
      case "material-group-removed":
        engine.removeMaterialGroup(
          projectedMaterialGroupId(this.#slot, command.groupId)
        );
        break;
      case "blend-group-defined":
        engine.defineBlendGroup(
          projectTilesetBlendGroup(this.#slot, command.group)
        );
        break;
      case "blend-group-removed":
        engine.removeBlendGroup(
          projectedBlendGroupId(this.#slot, command.groupId)
        );
        break;
      case "tile-size-updated":
        engine.defineBlocks(
          projectTilesetBlocks(this.#slot, this.#tileset.blocks)
        );
        break;
      default: {
        const unhandled: never = command;
        throw new Error(
          `TilesetProjection: unhandled action '${(unhandled as TilesetDocumentCommand).action}'.`
        );
      }
    }
  }

  #engineIndexOf(
    localIndex: number
  ): number {
    const positions: number[] = [];
    let index = 0;
    for (const block of this.#engine.blocks) {
      if (belongsToTileset(this.#slot, block.id)) {
        positions.push(index);
      }
      index++;
    }

    return positions[localIndex] ?? positions[positions.length - 1] ?? 0;
  }

  #localGroupId(
    groupId: string
  ): string | null {
    const prefix = projectedMaterialGroupId(this.#slot, "");

    return groupId.startsWith(prefix) ? groupId.slice(prefix.length) : null;
  }
}
