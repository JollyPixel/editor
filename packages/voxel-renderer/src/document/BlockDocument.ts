// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  resolveBlockDefinition,
  type BlockDefinition
} from "./blocks/BlockDefinition.ts";
import { classifyBlockRedefinition } from "./blocks/BlockRedefinition.ts";
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
   * replayed on behalf of another peer, `"replay"` for this client's pending
   * command applied or rolled back around a peer's.
   * @default "local"
   */
  origin?: VoxelCommandOrigin;
  /**
   * The peer behind a `"remote"` command, reported with the `"command"` event.
   */
  clientId?: string | null;
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

  applyCommand(
    command: TCommand | BlockCatalogCommand,
    options: VoxelApplyOptions = {}
  ): boolean {
    const { origin = "local", clientId } = options;

    const previous = definesBlock(command) ?
      this.blocks.get(command.block.id) :
      undefined;
    const applied = this.applyCommandToState(command);
    if (applied === null) {
      return false;
    }

    const context: VoxelCommandContext = { origin };
    if (clientId !== undefined) {
      context.clientId = clientId;
    }
    if (definesBlock(applied)) {
      context.redefinition = classifyBlockRedefinition(previous, applied.block);
    }
    this.emit("command", applied, context);

    return true;
  }

  defineBlock(
    def: BlockDefinition
  ): boolean {
    return this.applyCommand({
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
    return this.applyCommand({
      action: "block-removed",
      blockId
    });
  }

  moveBlock(
    blockId: number,
    toIndex: number
  ): boolean {
    return this.applyCommand({
      action: "block-moved",
      blockId,
      toIndex
    });
  }

  defineMaterialGroup(
    group: MaterialGroup | MaterialGroupJSON
  ): boolean {
    return this.applyCommand({
      action: "material-group-defined",
      group: group instanceof MaterialGroup ? group.toJSON() : group
    });
  }

  removeMaterialGroup(
    groupId: string
  ): boolean {
    return this.applyCommand({
      action: "material-group-removed",
      groupId
    });
  }

  defineBlendGroup(
    group: BlendGroup | BlendGroupJSON
  ): boolean {
    return this.applyCommand({
      action: "blend-group-defined",
      group: group instanceof BlendGroup ? group.toJSON() : group
    });
  }

  removeBlendGroup(
    groupId: string
  ): boolean {
    return this.applyCommand({
      action: "blend-group-removed",
      groupId
    });
  }

  protected abstract applyCommandToState(
    command: TCommand | BlockCatalogCommand
  ): TCommand | null;
}

function definesBlock(
  command: { action: string; }
): command is Extract<VoxelBlockCommand, { action: "block-defined"; }> {
  return command.action === "block-defined";
}
