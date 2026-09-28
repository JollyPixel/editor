// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition
} from "./blocks/BlockDefinition.ts";
import type { BlockRegistry } from "./blocks/BlockRegistry.ts";
import {
  MaterialGroup,
  type MaterialGroupJSON
} from "./materials/MaterialGroup.ts";
import type { MaterialGroupList } from "./materials/MaterialGroupList.ts";
import type {
  VoxelBlockCommand,
  VoxelCommandContext,
  VoxelCommandOrigin,
  VoxelMaterialGroupCommand
} from "./commands/types.ts";

export type BlockCatalogCommand =
  | VoxelBlockCommand
  | VoxelMaterialGroupCommand;

export type BlockDocumentEvents<TCommand> = {
  command: (command: TCommand, context: VoxelCommandContext) => void;
  loaded: () => void;
};

export interface VoxelApplyOptions {
  /**
   * Origin reported with the `"command"` event; `"remote"` for a command
   * replayed on behalf of another peer.
   * @default "local"
   */
  origin?: VoxelCommandOrigin;
}

export abstract class BlockDocument<
  TCommand extends { action: string; }
> extends Emitter<BlockDocumentEvents<TCommand>> {
  readonly blocks: BlockRegistry;
  readonly materialGroups: MaterialGroupList;

  constructor(
    blocks: BlockRegistry,
    materialGroups: MaterialGroupList
  ) {
    super();
    this.blocks = blocks;
    this.materialGroups = materialGroups;
  }

  apply(
    command: TCommand | BlockCatalogCommand,
    options: VoxelApplyOptions = {}
  ): boolean {
    const { origin = "local" } = options;

    const applied = this.fold(command);
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
      block: resolveBlockDefinition(def)
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

  protected abstract fold(
    command: TCommand | BlockCatalogCommand
  ): TCommand | null;
}
