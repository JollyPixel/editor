// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition
} from "./blocks/BlockDefinition.ts";
import { redefinitionOf } from "./blocks/BlockRedefinition.ts";
import type { BlockRegistry } from "./blocks/BlockRegistry.ts";
import {
  MaterialGroup,
  type MaterialGroupJSON
} from "./materials/MaterialGroup.ts";
import type { MaterialGroupList } from "./materials/MaterialGroupList.ts";
import {
  BlendGroup,
  type BlendGroupJSON
} from "./materials/BlendGroup.ts";
import type { BlendGroupList } from "./materials/BlendGroupList.ts";
import type {
  VoxelBlendGroupCommand,
  VoxelBlockCommand,
  VoxelCommandContext,
  VoxelCommandOrigin,
  VoxelMaterialGroupCommand
} from "./commands/types.ts";

export type BlockCatalogCommand =
  | VoxelBlockCommand
  | VoxelMaterialGroupCommand
  | VoxelBlendGroupCommand;

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
  readonly blendGroups: BlendGroupList;

  constructor(
    blocks: BlockRegistry,
    materialGroups: MaterialGroupList,
    blendGroups: BlendGroupList
  ) {
    super();
    this.blocks = blocks;
    this.materialGroups = materialGroups;
    this.blendGroups = blendGroups;
  }

  apply(
    command: TCommand | BlockCatalogCommand,
    options: VoxelApplyOptions = {}
  ): boolean {
    const { origin = "local" } = options;

    const previous = definesBlock(command) ?
      this.blocks.get(command.block.id) :
      undefined;
    const applied = this.fold(command);
    if (applied === null) {
      return false;
    }

    const context: VoxelCommandContext = { origin };
    if (definesBlock(applied)) {
      context.redefinition = redefinitionOf(previous, applied.block);
    }
    this.emit("command", applied, context);

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

  defineBlendGroup(
    group: BlendGroup | BlendGroupJSON
  ): boolean {
    return this.apply({
      action: "blend-group-defined",
      group: group instanceof BlendGroup ? group.toJSON() : group
    });
  }

  removeBlendGroup(
    groupId: string
  ): boolean {
    return this.apply({
      action: "blend-group-removed",
      groupId
    });
  }

  protected abstract fold(
    command: TCommand | BlockCatalogCommand
  ): TCommand | null;
}

function definesBlock(
  command: { action: string; }
): command is Extract<VoxelBlockCommand, { action: "block-defined"; }> {
  return command.action === "block-defined";
}
